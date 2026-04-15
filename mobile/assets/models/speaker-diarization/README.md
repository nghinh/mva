# Bundled speaker diarization models

Place these bundled diarization model files in this folder:

- `model.onnx` — Pyannote segmentation 3.0
- `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` — CAM++ speaker embedding

Notes:
- Models are bundled directly into the app binary.
- No download flow is used.
- Current runtime uses utterance boundaries from VAD and the CAM++ embedding model for per-utterance clustering.
- The segmentation model is reserved for future finer-grained speaker-turn detection.
