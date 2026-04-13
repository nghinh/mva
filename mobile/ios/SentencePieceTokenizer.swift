import Foundation

final class SentencePieceTokenizer {
  private var modelPath: String?
  private var tokenToId: [String: Int] = [:]
  private var idToToken: [Int: String] = [:]
  private var nextDynamicId = 4

  private let bosId = 0
  private let eosId = 1
  private let padId = 2
  private let unkId = 3

  func load(modelPath: String) throws {
    guard FileManager.default.fileExists(atPath: modelPath) else {
      throw NSError(domain: "SentencePieceTokenizer", code: 1, userInfo: [NSLocalizedDescriptionKey: "SentencePiece model not found"])
    }
    self.modelPath = modelPath
    tokenToId.removeAll()
    idToToken.removeAll()
    nextDynamicId = 4
    register(token: "<s>", id: bosId)
    register(token: "</s>", id: eosId)
    register(token: "<pad>", id: padId)
    register(token: "<unk>", id: unkId)
  }

  func unload() {
    modelPath = nil
    tokenToId.removeAll()
    idToToken.removeAll()
    nextDynamicId = 4
  }

  func encodeToIds(text: String) -> [Int] {
    precondition(modelPath != nil, "SentencePiece tokenizer not loaded")
    let pieces = text.split(whereSeparator: { $0.isWhitespace }).map(String.init)
    return [bosId] + pieces.map(resolveTokenId) + [eosId]
  }

  func decodeFromIds(_ ids: [Int]) -> String {
    precondition(modelPath != nil, "SentencePiece tokenizer not loaded")
    return ids
      .filter { $0 != bosId && $0 != eosId && $0 != padId }
      .map { idToToken[$0] ?? "<unk>" }
      .joined(separator: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  func eosTokenId() -> Int { eosId }
  func bosTokenId() -> Int { bosId }

  private func resolveTokenId(_ token: String) -> Int {
    if let existing = tokenToId[token] {
      return existing
    }
    let id = nextDynamicId
    nextDynamicId += 1
    register(token: token, id: id)
    return id
  }

  private func register(token: String, id: Int) {
    tokenToId[token] = id
    idToToken[id] = token
  }
}
