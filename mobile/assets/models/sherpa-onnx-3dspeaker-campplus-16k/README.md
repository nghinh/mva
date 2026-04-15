# Speaker Embedding Model (3D-Speaker CampPlus)

This directory contains the bundled speaker embedding model for on-device diarization.

## Required Files

- `model.onnx` - The 3D-Speaker CampPlus ONNX model file

## Model Information

- **Model**: 3D-Speaker CampPlus (speech_campplus_sv_zh-cn_16k-common)
- **Purpose**: Speaker embedding extraction for speaker diarization
- **Embedding Dimension**: 512 (or model-specific)
- **Sample Rate**: 16 kHz
- **Input**: Float32 audio samples normalized to [-1, 1]

## Installation

The model is bundled with the app during the build process. No download required.

## Usage

```typescript
import { getSpeakerEmbeddingService } from '../native/speaker';

const service = getSpeakerEmbeddingService();
await service.initialize();

const embedding = await service.extractEmbedding(samples, 16000);
// embedding is Float32Array of dimension 512
```

## Notes

- Audio samples stay memory-only (never persisted to disk)
- Initialization is non-fatal - pipeline continues without diarization if model fails to load
- The model path follows the pattern: `<DocumentDirectory>/models/sherpa-onnx-3dspeaker-campplus-16k/model.onnx`