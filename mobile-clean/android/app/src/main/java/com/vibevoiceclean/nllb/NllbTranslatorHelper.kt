package com.vibevoiceclean.nllb

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import ai.onnxruntime.TensorInfo
import com.facebook.react.bridge.ReactApplicationContext
import java.io.File
import java.nio.FloatBuffer
import java.nio.LongBuffer
import kotlin.math.max
import kotlin.math.min

class NllbTranslatorHelper(private val reactContext: ReactApplicationContext) {
  private var loaded = false
  private var env: OrtEnvironment? = null
  private var encoderSession: OrtSession? = null
  private var decoderSession: OrtSession? = null
  private var decoderWithPastSession: OrtSession? = null
  private val tokenizer = SentencePieceTokenizer()
  private val requiredFiles = listOf(
    "encoder_model_quantized.onnx",
    "decoder_model_quantized.onnx",
    "decoder_with_past_model_quantized.onnx",
    "sentencepiece.bpe.model",
  )

  fun initialize(dir: String): Boolean {
    unload()
    if (dir.isBlank()) return false
    val missing = requiredFiles.filter { !File(dir, it).exists() }
    if (missing.isNotEmpty()) return false
    return try {
      val localEnv = OrtEnvironment.getEnvironment()
      encoderSession = localEnv.createSession(File(dir, requiredFiles[0]).absolutePath, OrtSession.SessionOptions())
      decoderSession = localEnv.createSession(File(dir, requiredFiles[1]).absolutePath, OrtSession.SessionOptions())
      decoderWithPastSession = localEnv.createSession(File(dir, requiredFiles[2]).absolutePath, OrtSession.SessionOptions())
      tokenizer.load(File(dir, requiredFiles[3]).absolutePath)
      env = localEnv
      loaded = true
      true
    } catch (_: Throwable) {
      unload()
      false
    }
  }

  fun translate(text: String, srcLang: String, tgtLang: String): String {
    if (!loaded || env == null || encoderSession == null || decoderSession == null || decoderWithPastSession == null) {
      throw IllegalStateException("NLLB translator not initialized")
    }
    val ids = tokenizer.encodeToIds(text)
    val generated = mutableListOf<Int>()
    var tokenId = tokenizer.bosTokenId()
    repeat(32) {
      val next = greedyDecodeStep(tokenId, ids)
      if (next == tokenizer.eosTokenId()) return@repeat
      generated += next
      tokenId = next
    }
    val decoded = tokenizer.decodeFromIds(generated)
    return if (decoded.isBlank()) "[$srcLang->$tgtLang] ${text.trim()}" else decoded
  }

  private fun greedyDecodeStep(tokenId: Int, inputIds: LongArray): Int {
    val environment = env ?: return tokenizer.eosTokenId()
    val session = decoderSession ?: return tokenizer.eosTokenId()
    val inputName = session.inputNames.firstOrNull() ?: return tokenizer.eosTokenId()

    OnnxTensor.createTensor(environment, LongBuffer.wrap(longArrayOf(tokenId.toLong())), longArrayOf(1, 1)).use { tokenTensor ->
      session.run(mapOf(inputName to tokenTensor)).use { outputs ->
        val tensor = outputs[0].value as? OnnxTensor ?: return tokenizer.eosTokenId()
        val info = tensor.info as? TensorInfo ?: return tokenizer.eosTokenId()
        val shape = info.shape
        val buffer = tensor.floatBuffer
        buffer.rewind()
        val values = FloatArray(buffer.remaining())
        buffer.get(values)
        if (values.isEmpty()) return tokenizer.eosTokenId()
        val vocabSize = if (shape.isNotEmpty() && shape.last() > 0) min(values.size, shape.last().toInt()) else values.size
        val offset = max(0, values.size - vocabSize)
        var best = 0
        var bestValue = Float.NEGATIVE_INFINITY
        for (i in 0 until max(1, vocabSize)) {
          val value = values[offset + i]
          if (value > bestValue) {
            bestValue = value
            best = i
          }
        }
        return best
      }
    }
  }

  fun isLoaded(): Boolean = loaded

  fun unload() {
    loaded = false
    decoderWithPastSession?.close()
    decoderWithPastSession = null
    decoderSession?.close()
    decoderSession = null
    encoderSession?.close()
    encoderSession = null
    env?.close()
    env = null
    tokenizer.unload()
  }
}
