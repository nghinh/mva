#!/bin/bash
# Phase 0 — tai model + du lieu test ve bench/cache
set -uo pipefail
CACHE="$(cd "$(dirname "$0")" && pwd)/cache"
mkdir -p "$CACHE"
cd "$CACHE"

echo "== [1/4] Zipformer-VI int8 (ung vien chinh, ~74MB) =="
if [ ! -d sherpa-onnx-zipformer-vi-int8-2025-04-20 ]; then
  curl -fL --retry 3 -o zvi.tar.bz2 \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-vi-int8-2025-04-20.tar.bz2 \
    && tar xjf zvi.tar.bz2 && rm -f zvi.tar.bz2 || echo "!! FAIL zipformer-vi"
fi

echo "== [2/4] Zipformer-VI-30M int8 (tran tham chieu, ~32MB) =="
if [ ! -d sherpa-onnx-zipformer-vi-30M-int8-2026-02-09 ]; then
  curl -fL --retry 3 -o z30.tar.bz2 \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09.tar.bz2 \
    && tar xjf z30.tar.bz2 && rm -f z30.tar.bz2 || echo "!! FAIL zipformer-vi-30m"
fi

echo "== [3/4] Omnilingual-300M CTC int8 (ve so, ~300MB) =="
OMNI_REPO="csukuangfj/sherpa-onnx-omnilingual-asr-1600-languages-300M-ctc-2025-11-12"
if [ ! -d omnilingual-300m ]; then
  FILES=$(curl -fsL "https://huggingface.co/api/models/$OMNI_REPO" \
    | /usr/bin/python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(s['rfilename'] for s in d.get('siblings',[])))" 2>/dev/null)
  echo "-- files trong repo:"; echo "$FILES"
  mkdir -p omnilingual-300m
  MODEL_FILE=$(echo "$FILES" | grep -E 'int8.*\.onnx$|\.int8\.onnx$' | head -1)
  [ -z "$MODEL_FILE" ] && MODEL_FILE=$(echo "$FILES" | grep -E '\.onnx$' | head -1)
  TOKENS_FILE=$(echo "$FILES" | grep -E 'tokens.*\.txt$' | head -1)
  if [ -n "$MODEL_FILE" ] && [ -n "$TOKENS_FILE" ]; then
    curl -fL --retry 3 -o "omnilingual-300m/$(basename "$MODEL_FILE")" \
      "https://huggingface.co/$OMNI_REPO/resolve/main/$MODEL_FILE" || echo "!! FAIL omni model"
    curl -fL --retry 3 -o "omnilingual-300m/$(basename "$TOKENS_FILE")" \
      "https://huggingface.co/$OMNI_REPO/resolve/main/$TOKENS_FILE" || echo "!! FAIL omni tokens"
  else
    echo "!! khong tim thay file onnx/tokens trong repo — bo qua omnilingual"
  fi
fi

echo "== [4/4] FLEURS vi_vn test set (~350 cau doc, ~150MB) =="
mkdir -p fleurs && cd fleurs
if [ ! -f test.tsv ]; then
  curl -fL --retry 3 -o test.tsv \
    "https://huggingface.co/datasets/google/fleurs/resolve/main/data/vi_vn/test.tsv" || echo "!! FAIL fleurs tsv"
fi
if [ ! -d test ]; then
  curl -fL --retry 3 -o test.tar.gz \
    "https://huggingface.co/datasets/google/fleurs/resolve/main/data/vi_vn/audio/test.tar.gz" \
    && tar xzf test.tar.gz && rm -f test.tar.gz || echo "!! FAIL fleurs audio"
fi
cd "$CACHE"

echo "== TONG KET =="
du -sh "$CACHE"/* 2>/dev/null
echo "DOWNLOAD_ALL_DONE"
