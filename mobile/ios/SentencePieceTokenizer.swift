import Foundation

/// Pure-Swift SentencePiece tokenizer that loads vocabulary from vocab.json
/// exported by prepare_nllb_mobile.py. Implements unigram tokenization
/// compatible with NLLB-200's sentencepiece model.
final class SentencePieceTokenizer {
  private(set) var isReady = false

  private var pieceToId: [String: Int] = [:]
  private var idToPiece: [Int: String] = [:]
  private var pieceScores: [String: Float] = [:]
  private var langCodeToId: [String: Int] = [:]

  private(set) var bosId: Int = 0
  private(set) var eosId: Int = 2
  private(set) var padId: Int = 1
  private(set) var unkId: Int = 3
  private(set) var vocabSize: Int = 0

  private static let sentencePieceSpace = "\u{2581}" // ▁

  func load(modelPath: String) throws {
    let vocabPath = (modelPath as NSString)
      .deletingLastPathComponent
      .appending("/vocab.json")

    guard FileManager.default.fileExists(atPath: vocabPath) else {
      throw NSError(
        domain: "SentencePieceTokenizer",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "vocab.json not found at \(vocabPath)"]
      )
    }

    let data = try Data(contentsOf: URL(fileURLWithPath: vocabPath))
    guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw NSError(
        domain: "SentencePieceTokenizer",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "Invalid vocab.json format"]
      )
    }

    bosId = json["bos_id"] as? Int ?? 0
    eosId = json["eos_id"] as? Int ?? 2
    padId = json["pad_id"] as? Int ?? 1
    unkId = json["unk_id"] as? Int ?? 3
    vocabSize = json["vocab_size"] as? Int ?? 0

    if let langTokens = json["lang_tokens"] as? [String: Int] {
      langCodeToId = langTokens
    }

    pieceToId.removeAll()
    idToPiece.removeAll()
    pieceScores.removeAll()

    if let pieces = json["pieces"] as? [String: [String: Any]] {
      pieceToId.reserveCapacity(pieces.count)
      idToPiece.reserveCapacity(pieces.count)
      pieceScores.reserveCapacity(pieces.count)

      for (piece, info) in pieces {
        guard let id = info["id"] as? Int else { continue }
        let score = (info["score"] as? Double).map(Float.init) ?? 0
        pieceToId[piece] = id
        idToPiece[id] = piece
        pieceScores[piece] = score
      }
    }

    isReady = true
  }

  func unload() {
    pieceToId.removeAll()
    idToPiece.removeAll()
    pieceScores.removeAll()
    langCodeToId.removeAll()
    isReady = false
  }

  func languageId(for code: String) -> Int? {
    return langCodeToId[code]
  }

  /// Encode text to token IDs for NLLB.
  /// Returns: [srcLangId, BOS, ...tokens..., EOS]
  func encode(text: String, srcLang: String) -> [Int] {
    guard isReady else {
      NSLog("[SentencePieceTokenizer] encode skipped: tokenizer not loaded")
      return [eosId]
    }

    let normalized = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !normalized.isEmpty else {
      return [eosId]
    }

    let prefixed = Self.sentencePieceSpace + normalized.replacingOccurrences(of: " ", with: Self.sentencePieceSpace)
    let tokenIds = tokenize(prefixed)

    let srcId = langCodeToId[srcLang] ?? unkId
    return [srcId] + tokenIds + [eosId]
  }

  /// Decode token IDs back to text.
  func decode(_ ids: [Int]) -> String {
    guard isReady else {
      NSLog("[SentencePieceTokenizer] decode skipped: tokenizer not loaded")
      return ""
    }

    let filtered = ids.filter { $0 != bosId && $0 != eosId && $0 != padId && !langCodeToId.values.contains($0) }

    let pieces = filtered.map { idToPiece[$0] ?? "" }
    let joined = pieces.joined()
    return joined
      .replacingOccurrences(of: Self.sentencePieceSpace, with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  func eosTokenId() -> Int { eosId }
  func bosTokenId() -> Int { bosId }

  // MARK: - Unigram tokenization via best-path (Viterbi)

  /// Tokenize a string using the unigram model's best-path algorithm.
  private func tokenize(_ text: String) -> [Int] {
    let chars = Array(text)
    let n = chars.count
    if n == 0 { return [] }

    let maxPieceLen = min(48, n)

    // bestScore[i] = best log-probability to reach position i
    var bestScore = [Float](repeating: -Float.infinity, count: n + 1)
    var bestPrev = [Int](repeating: 0, count: n + 1)
    var bestPieceLen = [Int](repeating: 0, count: n + 1)
    bestScore[0] = 0

    for i in 0..<n {
      if bestScore[i] == -Float.infinity { continue }

      for len in 1...min(maxPieceLen, n - i) {
        let piece = String(chars[i..<(i + len)])
        guard let score = pieceScores[piece] else { continue }

        let candidate = bestScore[i] + score
        if candidate > bestScore[i + len] {
          bestScore[i + len] = candidate
          bestPrev[i + len] = i
          bestPieceLen[i + len] = len
        }
      }

      // Unknown character fallback: single char as UNK
      if bestScore[i + 1] == -Float.infinity {
        bestScore[i + 1] = bestScore[i] - 100
        bestPrev[i + 1] = i
        bestPieceLen[i + 1] = 1
      }
    }

    // Backtrack
    var ids: [Int] = []
    var pos = n
    while pos > 0 {
      let len = bestPieceLen[pos]
      let piece = String(chars[(pos - len)..<pos])
      ids.append(pieceToId[piece] ?? unkId)
      pos = bestPrev[pos]
    }

    return ids.reversed()
  }
}
