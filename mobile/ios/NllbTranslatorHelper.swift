import Foundation
import onnxruntime_objc

/// Full NLLB-600M translator using ONNX Runtime with split decoder architecture
/// and greedy decoding with KV cache.
///
/// Loads encoder + decoder_with_past at init time (~1.07GB).
/// Lazy-loads decoder_model on first translate call and caches it.
/// Responds to memory warnings by releasing the decoder cache.
@objcMembers
final class NllbTranslatorHelper: NSObject {
  private(set) var isLoaded = false
  private(set) var loadedModelDir: String?

  private let tokenizer = SentencePieceTokenizer()

  private var encoderSession: ORTSession?
  private var decoderSession: ORTSession?       // lazy-loaded, cached
  private var decoderPastSession: ORTSession?
  private var env: ORTEnv?
  private var sessionOpts: ORTSessionOptions?

  private let maxLength = 128
  private let numLayers = 12
  private let numHeads = 16
  private let headDim: Int = 64

  private let inferenceQueue = DispatchQueue(label: "com.vnteki.mva.nllb", qos: .utility)

  // Pre-computed name arrays (avoid re-creating every call)
  private var pastNames: [String] = []
  private var presentNames: [String] = []
  private var outputNameSet: Set<String> = []

  override init() {
    super.init()
    // Pre-compute KV cache names once
    for i in 0..<numLayers {
      for c in ["decoder.key", "decoder.value", "encoder.key", "encoder.value"] {
        pastNames.append("past_key_values.\(i).\(c)")
        presentNames.append("present.\(i).\(c)")
      }
    }
    outputNameSet = Set(["logits"] + presentNames)

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleMemoryWarning),
      name: UIApplication.didReceiveMemoryWarningNotification,
      object: nil
    )
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
  }

  @objc private func handleMemoryWarning() {
    NSLog("[NllbTranslator] Memory warning — releasing decoder cache")
    decoderSession = nil
  }

  func initialize(modelDir: String) -> Bool {
    unload()

    guard !modelDir.isEmpty else { return false }
    let fm = FileManager.default

    let requiredFiles = [
      "encoder_model_quantized.onnx",
      "decoder_model_quantized.onnx",
      "decoder_with_past_model_quantized.onnx",
      "vocab.json",
    ]
    for f in requiredFiles {
      if !fm.fileExists(atPath: (modelDir as NSString).appendingPathComponent(f)) {
        NSLog("[NllbTranslator] Missing: \(f)")
        return false
      }
    }

    do {
      try tokenizer.load(
        modelPath: (modelDir as NSString).appendingPathComponent("sentencepiece.bpe.model")
      )

      env = try ORTEnv(loggingLevel: .warning)
      let opts = try ORTSessionOptions()
      try opts.setIntraOpNumThreads(1)
      try opts.setGraphOptimizationLevel(.basic)
      sessionOpts = opts

      let t0 = CFAbsoluteTimeGetCurrent()

      NSLog("[NllbTranslator] Loading encoder ...")
      encoderSession = try ORTSession(
        env: env!,
        modelPath: (modelDir as NSString).appendingPathComponent("encoder_model_quantized.onnx"),
        sessionOptions: opts
      )
      NSLog("[NllbTranslator] Encoder loaded in %.1fs", CFAbsoluteTimeGetCurrent() - t0)

      let t1 = CFAbsoluteTimeGetCurrent()
      NSLog("[NllbTranslator] Loading decoder_with_past ...")
      decoderPastSession = try ORTSession(
        env: env!,
        modelPath: (modelDir as NSString).appendingPathComponent("decoder_with_past_model_quantized.onnx"),
        sessionOptions: opts
      )
      NSLog("[NllbTranslator] Decoder_with_past loaded in %.1fs", CFAbsoluteTimeGetCurrent() - t1)

      loadedModelDir = modelDir
      isLoaded = true
      NSLog("[NllbTranslator] Ready (total %.1fs, 2 sessions)", CFAbsoluteTimeGetCurrent() - t0)
      return true
    } catch {
      NSLog("[NllbTranslator] Init failed: \(error)")
      unload()
      return false
    }
  }

  func translate(text: String, srcLang: String, tgtLang: String) throws -> String {
    guard isLoaded, let modelDir = loadedModelDir else {
      throw nllbError("Translator not initialized")
    }
    return try inferenceQueue.sync {
      try self.runTranslation(text: text, srcLang: srcLang, tgtLang: tgtLang, modelDir: modelDir)
    }
  }

  func unload() {
    encoderSession = nil
    decoderSession = nil
    decoderPastSession = nil
    sessionOpts = nil
    env = nil
    tokenizer.unload()
    isLoaded = false
    loadedModelDir = nil
  }

  // MARK: - Translation Pipeline

  private func runTranslation(text: String, srcLang: String, tgtLang: String, modelDir: String) throws -> String {
    let inputIds = tokenizer.encode(text: text, srcLang: srcLang)
    let encoderOutput = try runEncoder(inputIds: inputIds)
    let generated = try greedyDecode(
      encoderOutput: encoderOutput,
      encoderSeqLen: inputIds.count,
      tgtLang: tgtLang,
      modelDir: modelDir
    )
    return tokenizer.decode(generated)
  }

  // MARK: - Encoder

  private func runEncoder(inputIds: [Int]) throws -> ORTValue {
    let n = inputIds.count
    let idTensor = try makeTensor(inputIds.map { Int64($0) }, shape: [1, NSNumber(value: n)])
    let maskTensor = try makeTensor([Int64](repeating: 1, count: n), shape: [1, NSNumber(value: n)])

    let out = try encoderSession!.run(
      withInputs: ["input_ids": idTensor, "attention_mask": maskTensor],
      outputNames: Set(["last_hidden_state"]),
      runOptions: nil
    )
    guard let h = out["last_hidden_state"] else {
      throw nllbError("Encoder returned nil")
    }
    return h
  }

  // MARK: - Lazy decoder access

  private func getDecoderSession(modelDir: String) throws -> ORTSession {
    if let existing = decoderSession { return existing }
    let t0 = CFAbsoluteTimeGetCurrent()
    NSLog("[NllbTranslator] Lazy-loading decoder ...")
    let path = (modelDir as NSString).appendingPathComponent("decoder_model_quantized.onnx")
    let session = try ORTSession(env: env!, modelPath: path, sessionOptions: sessionOpts!)
    decoderSession = session
    NSLog("[NllbTranslator] Decoder loaded in %.1fs", CFAbsoluteTimeGetCurrent() - t0)
    return session
  }

  // MARK: - Greedy Decode (split decoder)

  private func greedyDecode(
    encoderOutput: ORTValue,
    encoderSeqLen: Int,
    tgtLang: String,
    modelDir: String
  ) throws -> [Int] {
    let tgtLangId = tokenizer.languageId(for: tgtLang) ?? tokenizer.unkId
    var generated: [Int] = []
    let encMask = try makeTensor(
      [Int64](repeating: 1, count: encoderSeqLen),
      shape: [1, NSNumber(value: encoderSeqLen)]
    )

    // === Step 0: first decoder (takes encoder_hidden_states) ===
    let dec = try getDecoderSession(modelDir: modelDir)
    let seedIds: [Int64] = [Int64(tokenizer.eosId), Int64(tgtLangId)]
    let seedTensor = try makeTensor(seedIds, shape: [1, NSNumber(value: seedIds.count)])

    let firstResult = try dec.run(
      withInputs: [
        "input_ids": seedTensor,
        "encoder_hidden_states": encoderOutput,
        "encoder_attention_mask": encMask,
      ],
      outputNames: outputNameSet,
      runOptions: nil
    )

    guard let firstLogits = firstResult["logits"] else {
      throw nllbError("Decoder step 0 returned nil logits")
    }

    let firstToken = try argmax(logits: firstLogits)
    if firstToken == tokenizer.eosId { return generated }
    generated.append(firstToken)

    var kvCache: [String: ORTValue] = [:]
    for (i, presentName) in presentNames.enumerated() {
      if let val = firstResult[presentName] {
        kvCache[pastNames[i]] = val
      }
    }

    // === Steps 1+: decoder_with_past (uses KV cache) ===
    for _ in 1..<maxLength {
      let nextTensor = try makeTensor([Int64(generated.last!)], shape: [1, 1])
      var inputs: [String: ORTValue] = [
        "input_ids": nextTensor,
        "encoder_attention_mask": encMask,
      ]
      for (k, v) in kvCache { inputs[k] = v }

      let result = try decoderPastSession!.run(
        withInputs: inputs,
        outputNames: outputNameSet,
        runOptions: nil
      )
      guard let logits = result["logits"] else { break }

      let tokenId = try argmax(logits: logits)
      if tokenId == tokenizer.eosId { break }
      generated.append(tokenId)

      kvCache.removeAll(keepingCapacity: true)
      for (i, presentName) in presentNames.enumerated() {
        if let val = result[presentName] {
          kvCache[pastNames[i]] = val
        }
      }
    }

    return generated
  }

  // MARK: - Helpers

  private func makeTensor(_ values: [Int64], shape: [NSNumber]) throws -> ORTValue {
    let data = Data(bytes: values, count: values.count * MemoryLayout<Int64>.size)
    return try ORTValue(
      tensorData: NSMutableData(data: data),
      elementType: .int64,
      shape: shape
    )
  }

  private func argmax(logits: ORTValue) throws -> Int {
    let data = try logits.tensorData() as Data
    let shape = try logits.tensorTypeAndShapeInfo().shape.map { $0.intValue }

    let vocabSize = shape.last ?? tokenizer.vocabSize
    guard vocabSize > 0 else { return tokenizer.eosId }

    let totalFloats = data.count / MemoryLayout<Float>.size
    let lastTokenStart = totalFloats - vocabSize

    var bestIdx = 0
    var bestVal: Float = -.infinity

    data.withUnsafeBytes { ptr in
      guard let floats = ptr.baseAddress?.assumingMemoryBound(to: Float.self) else { return }
      for i in 0..<vocabSize {
        let val = floats[lastTokenStart + i]
        if val > bestVal {
          bestVal = val
          bestIdx = i
        }
      }
    }

    return bestIdx
  }

  private func nllbError(_ msg: String) -> NSError {
    NSError(domain: "NllbTranslator", code: 2, userInfo: [NSLocalizedDescriptionKey: msg])
  }
}
