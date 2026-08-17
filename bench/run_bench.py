#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 0 — Benchmark WER + RTF cho cac engine STT tieng Viet (sherpa-onnx, CPU).

Cach dung:
  python run_bench.py list
  python run_bench.py run --model zipformer-vi [--max-utts 200] [--threads 4]
  python run_bench.py run --model all
  python run_bench.py run --model zipformer-vi --dataset meeting --meeting-dir /path/to/wavs
  python run_bench.py summary

Dataset:
  fleurs  (mac dinh): bench/cache/fleurs/test.tsv + test/*.wav  (giong doc — can tren lac quan)
  meeting: thu muc cac cap file  x.wav (16k mono) + x.txt (transcript) — audio hop that cua team
"""
import argparse
import glob
import json
import os
import re
import sys
import time
import unicodedata

import numpy as np
import soundfile as sf
import sherpa_onnx

BENCH = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BENCH, "cache")
RESULTS = os.path.join(BENCH, "results")
SENSEVOICE_DIR = os.path.abspath(os.path.join(
    BENCH, "..", "mobile", "assets", "models",
    "sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17"))

MODELS = {
    "zipformer-vi": {
        "kind": "transducer",
        "dir": os.path.join(CACHE, "sherpa-onnx-zipformer-vi-int8-2025-04-20"),
        "note": "ung vien chinh — Apache-2.0, 70k gio",
    },
    "zipformer-vi-30m": {
        "kind": "transducer",
        "dir": os.path.join(CACHE, "sherpa-onnx-zipformer-vi-30M-int8-2026-02-09"),
        "note": "tran tham chieu — CC-BY-NC-ND (KHONG ship)",
    },
    "sense-voice": {
        "kind": "sense_voice",
        "dir": SENSEVOICE_DIR,
        "note": "baseline hien tai (khong co vi) — do de thay khoang cach",
    },
    "omnilingual-300m": {
        "kind": "omnilingual",
        "dir": os.path.join(CACHE, "omnilingual-300m"),
        "note": "ve so C3 — Meta 1600 ngon ngu",
    },
}


# ---------------- text norm + WER ----------------

def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFC", s.lower())
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = s.replace("_", " ")
    return re.sub(r"\s+", " ", s).strip()


def edit_distance(ref, hyp):
    n, m = len(ref), len(hyp)
    if n == 0:
        return m
    prev = list(range(m + 1))
    for i in range(1, n + 1):
        cur = [i] + [0] * m
        for j in range(1, m + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1,
                         prev[j - 1] + (ref[i - 1] != hyp[j - 1]))
        prev = cur
    return prev[m]


# ---------------- datasets ----------------

def load_fleurs(max_utts=None):
    tsv = os.path.join(CACHE, "fleurs", "test.tsv")
    audio_dir = os.path.join(CACHE, "fleurs", "test")
    if not os.path.isfile(tsv):
        sys.exit("Chua co FLEURS — chay bench/download.sh truoc.")
    items = []
    with open(tsv, encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            wav = os.path.join(audio_dir, parts[1])
            text = parts[3] if len(parts) > 3 else parts[2]
            if os.path.isfile(wav):
                items.append((wav, text))
    if max_utts:
        items = items[:max_utts]
    return items


def load_meeting(meeting_dir, max_utts=None):
    items = []
    for wav in sorted(glob.glob(os.path.join(meeting_dir, "*.wav"))):
        txt = os.path.splitext(wav)[0] + ".txt"
        if os.path.isfile(txt):
            with open(txt, encoding="utf-8") as f:
                items.append((wav, f.read()))
    if max_utts:
        items = items[:max_utts]
    return items


# ---------------- recognizers ----------------

def _find(d, patterns):
    for p in patterns:
        hits = sorted(glob.glob(os.path.join(d, p)))
        if hits:
            return hits[0]
    return None


def create_recognizer(name, threads):
    cfg = MODELS[name]
    d = cfg["dir"]
    if not os.path.isdir(d):
        sys.exit(f"Chua co model dir: {d} — chay bench/download.sh truoc.")
    tokens = _find(d, ["tokens.txt", "*tokens*.txt"])
    kind = cfg["kind"]

    if kind == "transducer":
        enc = _find(d, ["encoder*.int8.onnx", "encoder*.onnx"])
        dec = _find(d, ["decoder*[!8].onnx", "decoder*.onnx"])
        join = _find(d, ["joiner*.int8.onnx", "joiner*.onnx"])
        return sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=enc, decoder=dec, joiner=join, tokens=tokens,
            num_threads=threads, decoding_method="greedy_search")

    if kind == "sense_voice":
        model = _find(d, ["model.int8.onnx", "model.onnx"])
        return sherpa_onnx.OfflineRecognizer.from_sense_voice(
            model=model, tokens=tokens, num_threads=threads,
            use_itn=False, language="auto")

    if kind == "omnilingual":
        model = _find(d, ["*int8*.onnx", "*.onnx"])
        return sherpa_onnx.OfflineRecognizer.from_omnilingual_asr_ctc(
            model=model, tokens=tokens, num_threads=threads)

    sys.exit(f"kind la? {kind}")


# ---------------- run ----------------

def read_wav_16k(path):
    samples, sr = sf.read(path, dtype="float32", always_2d=False)
    if samples.ndim > 1:
        samples = samples.mean(axis=1)
    if sr != 16000:
        # resample tuyen tinh don gian — du tot cho benchmark
        n = int(len(samples) * 16000 / sr)
        samples = np.interp(
            np.linspace(0, len(samples) - 1, n),
            np.arange(len(samples)), samples).astype(np.float32)
        sr = 16000
    return samples, sr


def run_model(name, items, threads):
    os.makedirs(RESULTS, exist_ok=True)
    print(f"\n=== {name} ({MODELS[name]['note']}) — {len(items)} cau ===")
    t0 = time.time()
    rec = create_recognizer(name, threads)
    print(f"load model: {time.time() - t0:.1f}s")

    total_err = total_ref = 0
    total_audio = total_decode = 0.0
    hyp_path = os.path.join(RESULTS, f"{name}.jsonl")
    with open(hyp_path, "w", encoding="utf-8") as out:
        for i, (wav, ref_text) in enumerate(items):
            samples, sr = read_wav_16k(wav)
            dur = len(samples) / sr
            t = time.time()
            s = rec.create_stream()
            s.accept_waveform(sr, samples)
            rec.decode_stream(s)
            dt = time.time() - t
            hyp_text = s.result.text
            ref_w = norm_text(ref_text).split()
            hyp_w = norm_text(hyp_text).split()
            err = edit_distance(ref_w, hyp_w)
            total_err += err
            total_ref += len(ref_w)
            total_audio += dur
            total_decode += dt
            out.write(json.dumps({
                "wav": os.path.basename(wav), "dur_s": round(dur, 2),
                "decode_s": round(dt, 3), "ref": " ".join(ref_w),
                "hyp": " ".join(hyp_w), "err": err}, ensure_ascii=False) + "\n")
            if (i + 1) % 25 == 0:
                print(f"  {i+1}/{len(items)}  WER tam thoi: "
                      f"{100.0*total_err/max(1,total_ref):.2f}%  "
                      f"RTF: {total_decode/max(0.01,total_audio):.3f}")

    wer = 100.0 * total_err / max(1, total_ref)
    rtf = total_decode / max(0.01, total_audio)
    row = {
        "model": name, "utts": len(items),
        "audio_min": round(total_audio / 60, 1),
        "wer_pct": round(wer, 2), "rtf_cpu_mac": round(rtf, 4),
        "decode_s": round(total_decode, 1), "threads": threads,
    }
    print(f"==> WER {row['wer_pct']}%  RTF {row['rtf_cpu_mac']}  "
          f"({row['audio_min']} phut audio, decode {row['decode_s']}s)")

    csv_path = os.path.join(RESULTS, "summary.csv")
    header = not os.path.isfile(csv_path)
    with open(csv_path, "a", encoding="utf-8") as f:
        if header:
            f.write(",".join(row.keys()) + "\n")
        f.write(",".join(str(v) for v in row.values()) + "\n")
    return row


def print_summary():
    csv_path = os.path.join(RESULTS, "summary.csv")
    if not os.path.isfile(csv_path):
        sys.exit("Chua co ket qua nao.")
    with open(csv_path, encoding="utf-8") as f:
        lines = [l.strip().split(",") for l in f if l.strip()]
    head, rows = lines[0], lines[1:]
    widths = [max(len(head[i]), max((len(r[i]) for r in rows), default=0))
              for i in range(len(head))]
    fmt = "  ".join("{:<%d}" % w for w in widths)
    print(fmt.format(*head))
    for r in rows:
        print(fmt.format(*r))


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    sub.add_parser("summary")
    rp = sub.add_parser("run")
    rp.add_argument("--model", required=True,
                    choices=list(MODELS) + ["all"])
    rp.add_argument("--max-utts", type=int, default=200)
    rp.add_argument("--threads", type=int, default=4)
    rp.add_argument("--dataset", default="fleurs", choices=["fleurs", "meeting"])
    rp.add_argument("--meeting-dir", default=None)
    args = ap.parse_args()

    if args.cmd == "list":
        for k, v in MODELS.items():
            ok = "OK " if os.path.isdir(v["dir"]) else "--- (chua tai)"
            print(f"{k:20s} {ok}  {v['note']}")
        return
    if args.cmd == "summary":
        print_summary()
        return

    if args.dataset == "meeting":
        if not args.meeting_dir:
            sys.exit("--dataset meeting can --meeting-dir")
        items = load_meeting(args.meeting_dir, args.max_utts)
    else:
        items = load_fleurs(args.max_utts)
    if not items:
        sys.exit("Khong co du lieu test.")

    names = list(MODELS) if args.model == "all" else [args.model]
    for n in names:
        try:
            run_model(n, items, args.threads)
        except Exception as e:  # noqa: BLE001 — benchmark tiep tuc model khac
            print(f"!! {n} loi: {e}")


if __name__ == "__main__":
    main()
