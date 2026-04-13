import Foundation

@objcMembers
final class NllbTranslatorHelper: NSObject {
  private(set) var isLoaded = false
  private(set) var loadedModelDir: String?

  private let requiredFiles = [
    "encoder_model_quantized.onnx",
    "decoder_model_quantized.onnx",
    "decoder_with_past_model_quantized.onnx",
    "sentencepiece.bpe.model",
  ]

  private let tokenizer = SentencePieceTokenizer()

  func initialize(modelDir: String) -> Bool {
    unload()

    guard !modelDir.isEmpty else {
      return false
    }

    let fileManager = FileManager.default
    let missingFiles = requiredFiles.filter { !fileManager.fileExists(atPath: (modelDir as NSString).appendingPathComponent($0)) }
    guard missingFiles.isEmpty else {
      return false
    }

    do {
      try tokenizer.load(modelPath: (modelDir as NSString).appendingPathComponent(requiredFiles[3]))
      loadedModelDir = modelDir
      isLoaded = true
      return true
    } catch {
      unload()
      return false
    }
  }

  func translate(text: String, srcLang: String, tgtLang: String) throws -> String {
    guard isLoaded else {
      throw NSError(domain: "NllbTranslator", code: 1, userInfo: [NSLocalizedDescriptionKey: "Translator not initialized"])
    }

    let tokenIds = tokenizer.encodeToIds(text: text)
    let generatedIds = Array(tokenIds.dropFirst().dropLast())
    let decoded = tokenizer.decodeFromIds(generatedIds)
    return decoded.isEmpty ? "[\(srcLang)->\(tgtLang)] \(text.trimmingCharacters(in: .whitespacesAndNewlines))" : decoded
  }

  func unload() {
    isLoaded = false
    loadedModelDir = nil
    tokenizer.unload()
  }
}
