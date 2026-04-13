#!/usr/bin/env python3
"""
prepare_nllb_mobile.py

Exports NLLB-200-distilled-600M to optimized int8 ONNX with split decoder
for mobile deployment (without using optimum high-level API).

Produces:
  encoder_model_quantized.onnx
  decoder_model_quantized.onnx
  decoder_with_past_model_quantized.onnx
  sentencepiece.bpe.model
  vocab.json  (token→id mapping for pure-Swift tokenizer)

Requirements:
  pip install transformers sentencepiece onnxruntime onnx torch

Usage:
  python scripts/prepare_nllb_mobile.py --output-dir ./nllb-600m-mobile
"""

import argparse
import json
import os
import shutil
from pathlib import Path

import torch
import torch.nn as nn
import onnx

MODEL_ID = "facebook/nllb-200-distilled-600M"


def export_encoder(model, tokenizer, onnx_dir: Path):
    """Export encoder to ONNX."""
    print("  Exporting encoder ...")
    encoder = model.get_encoder()
    encoder.eval()

    dummy_input_ids = torch.tensor([[1, 2, 3, 4, 5]], dtype=torch.long)
    dummy_attention_mask = torch.ones_like(dummy_input_ids)

    torch.onnx.export(
        encoder,
        (dummy_input_ids, dummy_attention_mask),
        str(onnx_dir / "encoder_model.onnx"),
        input_names=["input_ids", "attention_mask"],
        output_names=["last_hidden_state"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "sequence"},
            "attention_mask": {0: "batch", 1: "sequence"},
            "last_hidden_state": {0: "batch", 1: "sequence"},
        },
        opset_version=14,
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"  encoder_model.onnx: {(onnx_dir / 'encoder_model.onnx').stat().st_size / 1024 / 1024:.1f} MB")


class DecoderWrapper(nn.Module):
    """Wraps the NLLB decoder for ONNX export without KV cache inputs.
    Directly holds decoder + lm_head + embed_tokens references so
    weights are captured by the ONNX tracer."""

    def __init__(self, full_model):
        super().__init__()
        self.decoder = full_model.model.decoder
        self.lm_head = full_model.lm_head
        self.final_logits_bias = getattr(full_model, "final_logits_bias", None)

    def forward(self, input_ids, encoder_hidden_states, encoder_attention_mask):
        decoder_out = self.decoder(
            input_ids=input_ids,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            use_cache=True,
        )
        hidden = decoder_out[0]
        logits = self.lm_head(hidden)
        if self.final_logits_bias is not None:
            logits = logits + self.final_logits_bias

        pkv = decoder_out[1]
        flat_out = [logits]
        for layer_kv in pkv:
            for t in layer_kv:
                flat_out.append(t)
        return tuple(flat_out)


class DecoderWithPastWrapper(nn.Module):
    """Wraps the NLLB decoder for ONNX export with KV cache inputs."""

    def __init__(self, full_model, num_layers):
        super().__init__()
        self.decoder = full_model.model.decoder
        self.lm_head = full_model.lm_head
        self.final_logits_bias = getattr(full_model, "final_logits_bias", None)
        self.num_layers = num_layers

    def forward(self, input_ids, encoder_hidden_states, encoder_attention_mask, *past_key_values_flat):
        pkv = []
        for i in range(self.num_layers):
            pkv.append(tuple(past_key_values_flat[i * 4: i * 4 + 4]))
        pkv = tuple(pkv)

        decoder_out = self.decoder(
            input_ids=input_ids,
            encoder_hidden_states=encoder_hidden_states,
            encoder_attention_mask=encoder_attention_mask,
            past_key_values=pkv,
            use_cache=True,
        )
        hidden = decoder_out[0]
        logits = self.lm_head(hidden)
        if self.final_logits_bias is not None:
            logits = logits + self.final_logits_bias

        new_pkv = decoder_out[1]
        flat_out = [logits]
        for layer_kv in new_pkv:
            for t in layer_kv:
                flat_out.append(t)
        return tuple(flat_out)


def export_decoder(model, onnx_dir: Path):
    """Export decoder (first step, no KV cache) to ONNX."""
    print("  Exporting decoder (first step, no KV cache) ...")
    wrapper = DecoderWrapper(model)
    wrapper.eval()

    config = model.config
    num_layers = config.decoder_layers
    batch, enc_seq, dec_seq = 1, 5, 2
    d_model = config.d_model

    dummy_input_ids = torch.tensor([[2, 256047]], dtype=torch.long)  # EOS + tgt_lang
    dummy_enc_hidden = torch.randn(batch, enc_seq, d_model)
    dummy_enc_mask = torch.ones(batch, enc_seq, dtype=torch.long)

    output_names = ["logits"]
    dynamic_axes = {
        "input_ids": {0: "batch", 1: "decoder_sequence"},
        "encoder_hidden_states": {0: "batch", 1: "encoder_sequence"},
        "encoder_attention_mask": {0: "batch", 1: "encoder_sequence"},
        "logits": {0: "batch", 1: "decoder_sequence"},
    }

    for i in range(num_layers):
        for component in ["decoder.key", "decoder.value", "encoder.key", "encoder.value"]:
            name = f"present.{i}.{component}"
            output_names.append(name)
            if "decoder" in component:
                dynamic_axes[name] = {0: "batch", 2: "decoder_sequence"}
            else:
                dynamic_axes[name] = {0: "batch", 2: "encoder_sequence"}

    torch.onnx.export(
        wrapper,
        (dummy_input_ids, dummy_enc_hidden, dummy_enc_mask),
        str(onnx_dir / "decoder_model.onnx"),
        input_names=["input_ids", "encoder_hidden_states", "encoder_attention_mask"],
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=14,
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"  decoder_model.onnx: {(onnx_dir / 'decoder_model.onnx').stat().st_size / 1024 / 1024:.1f} MB")


def export_decoder_with_past(model, onnx_dir: Path):
    """Export decoder (subsequent steps, with KV cache) to ONNX."""
    print("  Exporting decoder (with KV cache) ...")
    config = model.config
    num_layers = config.decoder_layers
    num_heads = config.decoder_attention_heads
    head_dim = config.d_model // num_heads

    wrapper = DecoderWithPastWrapper(model, num_layers)
    wrapper.eval()

    batch, enc_seq, past_seq = 1, 5, 2

    dummy_input_ids = torch.tensor([[42]], dtype=torch.long)
    dummy_enc_hidden = torch.randn(batch, enc_seq, config.d_model)
    dummy_enc_mask = torch.ones(batch, enc_seq, dtype=torch.long)

    past_kv_flat = []
    for _ in range(num_layers):
        past_kv_flat.append(torch.randn(batch, num_heads, past_seq, head_dim))  # decoder key
        past_kv_flat.append(torch.randn(batch, num_heads, past_seq, head_dim))  # decoder value
        past_kv_flat.append(torch.randn(batch, num_heads, enc_seq, head_dim))   # encoder key
        past_kv_flat.append(torch.randn(batch, num_heads, enc_seq, head_dim))   # encoder value

    input_names = ["input_ids", "encoder_hidden_states", "encoder_attention_mask"]
    dynamic_axes = {
        "input_ids": {0: "batch", 1: "decoder_sequence"},
        "encoder_hidden_states": {0: "batch", 1: "encoder_sequence"},
        "encoder_attention_mask": {0: "batch", 1: "encoder_sequence"},
        "logits": {0: "batch", 1: "decoder_sequence"},
    }

    for i in range(num_layers):
        for component in ["decoder.key", "decoder.value", "encoder.key", "encoder.value"]:
            name = f"past_key_values.{i}.{component}"
            input_names.append(name)
            if "decoder" in component:
                dynamic_axes[name] = {0: "batch", 2: "past_sequence"}
            else:
                dynamic_axes[name] = {0: "batch", 2: "encoder_sequence"}

    output_names = ["logits"]
    for i in range(num_layers):
        for component in ["decoder.key", "decoder.value", "encoder.key", "encoder.value"]:
            name = f"present.{i}.{component}"
            output_names.append(name)
            if "decoder" in component:
                dynamic_axes[name] = {0: "batch", 2: "past_sequence_plus_1"}
            else:
                dynamic_axes[name] = {0: "batch", 2: "encoder_sequence"}

    all_inputs = (dummy_input_ids, dummy_enc_hidden, dummy_enc_mask) + tuple(past_kv_flat)

    torch.onnx.export(
        wrapper,
        all_inputs,
        str(onnx_dir / "decoder_with_past_model.onnx"),
        input_names=input_names,
        output_names=output_names,
        dynamic_axes=dynamic_axes,
        opset_version=14,
        do_constant_folding=True,
        dynamo=False,
    )
    print(f"  decoder_with_past_model.onnx: {(onnx_dir / 'decoder_with_past_model.onnx').stat().st_size / 1024 / 1024:.1f} MB")


def quantize_models(onnx_dir: Path, output_dir: Path):
    """Quantize encoder and decoder models to int8."""
    from onnxruntime.quantization import quantize_dynamic, QuantType

    files_to_quantize = [
        ("encoder_model.onnx", "encoder_model_quantized.onnx"),
        ("decoder_model.onnx", "decoder_model_quantized.onnx"),
        ("decoder_with_past_model.onnx", "decoder_with_past_model_quantized.onnx"),
    ]

    print("[2/4] Quantizing models to int8 ...")
    for src_name, dst_name in files_to_quantize:
        src = onnx_dir / src_name
        dst = output_dir / dst_name
        if not src.exists():
            print(f"  WARNING: {src_name} not found, skipping")
            continue
        print(f"  {src_name} → {dst_name}")
        quantize_dynamic(
            model_input=str(src),
            model_output=str(dst),
            weight_type=QuantType.QInt8,
        )
        print(f"  Done: {dst.stat().st_size / 1024 / 1024:.1f} MB")


def copy_tokenizer_model(tokenizer, output_dir: Path):
    """Copy sentencepiece model."""
    print("[3/4] Copying sentencepiece model ...")
    sp_src = Path(tokenizer.vocab_file)
    sp_dst = output_dir / "sentencepiece.bpe.model"
    shutil.copy2(str(sp_src), str(sp_dst))
    print(f"  Copied: {sp_dst.stat().st_size / 1024:.1f} KB")


def export_vocab_json(tokenizer, output_dir: Path):
    """Export vocabulary as JSON for the pure-Swift tokenizer."""
    print("[4/4] Exporting vocab.json for Swift tokenizer ...")

    sp = tokenizer.sp_model
    vocab = {}
    for i in range(sp.get_piece_size()):
        piece = sp.id_to_piece(i)
        score = sp.get_score(i)
        hf_id = tokenizer.convert_tokens_to_ids(piece)
        vocab[piece] = {"id": hf_id, "score": float(score)}

    # NLLB language codes are added tokens beyond the SP vocabulary
    lang_tokens = {}
    if hasattr(tokenizer, "lang_code_to_id") and tokenizer.lang_code_to_id:
        lang_tokens = dict(tokenizer.lang_code_to_id)
    else:
        # Fallback: enumerate added_tokens_encoder for language codes
        for token, idx in tokenizer.added_tokens_encoder.items():
            tok_str = str(token)
            if "_" in tok_str and len(tok_str) <= 12 and tok_str[0].islower():
                lang_tokens[tok_str] = idx
                vocab[tok_str] = {"id": idx, "score": 0.0}

    eos_id = tokenizer.convert_tokens_to_ids("</s>")
    pad_id = tokenizer.convert_tokens_to_ids("<pad>")
    unk_id = tokenizer.convert_tokens_to_ids("<unk>")

    data = {
        "vocab_size": sp.get_piece_size() + len(lang_tokens),
        "bos_id": eos_id,
        "eos_id": eos_id,
        "pad_id": pad_id,
        "unk_id": unk_id,
        "lang_tokens": lang_tokens,
        "pieces": vocab,
    }

    vocab_path = output_dir / "vocab.json"
    with open(vocab_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  Exported {len(vocab)} pieces + {len(lang_tokens)} language tokens")
    print(f"  File: {vocab_path.stat().st_size / 1024 / 1024:.1f} MB")


def print_summary(output_dir: Path):
    print("\n=== Output Summary ===")
    total = 0
    for f in sorted(output_dir.iterdir()):
        if f.name.startswith("_"):
            continue
        size = f.stat().st_size
        total += size
        print(f"  {f.name:50s} {size / 1024 / 1024:8.1f} MB")
    print(f"  {'TOTAL':50s} {total / 1024 / 1024:8.1f} MB")


def main():
    parser = argparse.ArgumentParser(description="Prepare NLLB-600M for mobile")
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./nllb-600m-mobile",
        help="Output directory for model files",
    )
    parser.add_argument(
        "--skip-export",
        action="store_true",
        help="Skip ONNX export (reuse existing _onnx_raw)",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    onnx_dir = output_dir / "_onnx_raw"
    onnx_dir.mkdir(exist_ok=True)

    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    print(f"Loading model {MODEL_ID} ...")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=False)
    model = AutoModelForSeq2SeqLM.from_pretrained(
        MODEL_ID, torch_dtype=torch.float32, attn_implementation="eager"
    )
    model.eval()

    if not args.skip_export:
        print("[1/4] Exporting to ONNX (split decoder) ...")
        with torch.no_grad():
            export_encoder(model, tokenizer, onnx_dir)
            export_decoder(model, onnx_dir)
            export_decoder_with_past(model, onnx_dir)
    else:
        print("[1/4] Skipping ONNX export (--skip-export)")

    quantize_models(onnx_dir, output_dir)
    copy_tokenizer_model(tokenizer, output_dir)
    export_vocab_json(tokenizer, output_dir)
    print_summary(output_dir)

    print(f"\nDone! Copy the files (excluding _onnx_raw/) to your device.")
    print(f"On iOS: place them in the app's Documents/models/nllb-600m-mobile/")


if __name__ == "__main__":
    main()
