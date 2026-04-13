package com.vibevoicenative.nllb

import java.io.File

class SentencePieceTokenizer {
  private var modelPath: String? = null
  private val tokenToId = linkedMapOf<String, Int>()
  private val idToToken = linkedMapOf<Int, String>()

  private val bosId = 0
  private val eosId = 1
  private val padId = 2
  private val unkId = 3
  private var nextDynamicId = 4

  fun load(path: String) {
    if (!File(path).exists()) {
      throw IllegalArgumentException("SentencePiece model not found at $path")
    }
    modelPath = path
    tokenToId.clear()
    idToToken.clear()
    nextDynamicId = 4
    registerToken("<s>", bosId)
    registerToken("</s>", eosId)
    registerToken("<pad>", padId)
    registerToken("<unk>", unkId)
  }

  fun unload() {
    modelPath = null
    tokenToId.clear()
    idToToken.clear()
    nextDynamicId = 4
  }

  fun encodeToIds(text: String): LongArray {
    ensureLoaded()
    val pieces = text.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    val ids = LongArray(pieces.size + 2)
    ids[0] = bosId.toLong()
    pieces.forEachIndexed { index, token ->
      ids[index + 1] = resolveTokenId(token).toLong()
    }
    ids[ids.lastIndex] = eosId.toLong()
    return ids
  }

  fun decodeFromIds(tokenIds: List<Int>): String {
    ensureLoaded()
    return tokenIds
      .filter { it != bosId && it != eosId && it != padId }
      .map { idToToken[it] ?: "<unk>" }
      .joinToString(" ")
      .replace(" <eos>", "")
      .trim()
  }

  fun eosTokenId(): Int = eosId
  fun bosTokenId(): Int = bosId

  private fun resolveTokenId(token: String): Int {
    return tokenToId[token] ?: run {
      val id = nextDynamicId++
      registerToken(token, id)
      id
    }
  }

  private fun registerToken(token: String, id: Int) {
    tokenToId[token] = id
    idToToken[id] = token
  }

  private fun ensureLoaded() {
    check(!modelPath.isNullOrBlank()) { "SentencePiece tokenizer not loaded" }
  }
}
