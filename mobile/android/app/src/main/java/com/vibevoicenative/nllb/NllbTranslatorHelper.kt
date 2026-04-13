package com.vibevoicenative.nllb

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
  private var modelDir: String? = null
  private var env: OrtEnvironment? = null
  private var encoderSession: OrtSession? = null
  private var decoderSession: OrtSession? = null
  private var decoderWithPastSession: OrtSession? = null
  private val tokenizer = SentencePieceTokenizer()

  private var encoderInputIdsName: String? = null
  private var encoderAttentionMaskName: String? = null
  private var decoderInputIdsName: String? = null
  private var decoderEncoderHiddenStatesName: String? = null
  private var decoderAttentionMaskName: String? = null
  private var decoderLogitsOutputName: String? = null
  private var decoderWithPastInputIdsName: String? = null
  private var decoderWithPastEncoderHiddenStatesName: String? = null
  private var decoderWithPastAttentionMaskName: String? = null
  private var decoderWithPastLogitsOutputName: String? = null
  private var decoderWithPastCacheInputNames: List<String> = emptyList()
  private var decoderWithPastCacheOutputNames: List<String> = emptyList()
  private var supportsDecoderWithPastCache = false

  private val requiredFiles = listOf(
    "encoder_model_quantized.onnx",
    "decoder_model_quantized.onnx",
    "decoder_with_past_model_quantized.onnx",
    "sentencepiece.bpe.model",
  )

  private data class EncoderState(
    val values: FloatArray,
    val shape: LongArray,
    val attentionMask: LongArray,
  )

  fun initialize(dir: String): Boolean {
    unload()

    if (dir.isBlank()) return false
    val missingFiles = requiredFiles.filter { !File(dir, it).exists() }
    if (missingFiles.isNotEmpty()) return false

    return try {
      val localEnv = OrtEnvironment.getEnvironment()
      val encoder = createSession(localEnv, File(dir, requiredFiles[0]).absolutePath)
      val decoder = createSession(localEnv, File(dir, requiredFiles[1]).absolutePath)
      val decoderWithPast = createSession(localEnv, File(dir, requiredFiles[2]).absolutePath)
      tokenizer.load(File(dir, requiredFiles[3]).absolutePath)

      env = localEnv
      encoderSession = encoder
      decoderSession = decoder
      decoderWithPastSession = decoderWithPast
      modelDir = dir
      resolveSessionBindings()
      loaded = true
      true
    } catch (_: Throwable) {
      unload()
      false
    }
  }

  private fun createSession(environment: OrtEnvironment, path: String): OrtSession {
    val options = OrtSession.SessionOptions()
    options.setIntraOpNumThreads(2)
    try {
      options.addXnnpack(emptyMap())
    } catch (_: Throwable) {
      // CPU fallback is acceptable.
    }
    return environment.createSession(path, options)
  }

  private fun resolveSessionBindings() {
    val encoder = encoderSession ?: return
    encoderInputIdsName = resolveInputName(encoder, "input_ids", "encoder_input_ids")
    encoderAttentionMaskName = resolveInputName(encoder, "attention_mask", "encoder_attention_mask")

    val decoder = decoderSession ?: return
    decoderInputIdsName = resolveInputName(decoder, "input_ids", "decoder_input_ids", "tokens")
    decoderEncoderHiddenStatesName = resolveInputName(decoder, "encoder_hidden_states", "hidden_states", "encoder_output")
    decoderAttentionMaskName = resolveInputName(decoder, "attention_mask", "decoder_attention_mask", "encoder_attention_mask")
    decoderLogitsOutputName = resolveOutputName(decoder, "logits", "lm_logits", "output", "output0")

    val decoderPast = decoderWithPastSession ?: return
    decoderWithPastInputIdsName = resolveInputName(decoderPast, "input_ids", "decoder_input_ids", "tokens")
    decoderWithPastEncoderHiddenStatesName = resolveInputName(decoderPast, "encoder_hidden_states", "hidden_states", "encoder_output")
    decoderWithPastAttentionMaskName = resolveInputName(decoderPast, "attention_mask", "decoder_attention_mask", "encoder_attention_mask")
    decoderWithPastLogitsOutputName = resolveOutputName(decoderPast, "logits", "lm_logits", "output", "output0")
    decoderWithPastCacheInputNames = detectCacheNames(decoderPast.inputNames)
    decoderWithPastCacheOutputNames = detectCacheNames(decoderPast.outputNames)
    supportsDecoderWithPastCache = decoderWithPastCacheInputNames.isNotEmpty() && decoderWithPastCacheOutputNames.isNotEmpty()
  }

  private fun resolveInputName(session: OrtSession, vararg candidates: String): String? {
    val names = session.inputNames.toList()
    candidates.forEach { candidate ->
      names.firstOrNull { normalizeName(it) == normalizeName(candidate) }?.let { return it }
    }
    candidates.forEach { candidate ->
      names.firstOrNull { normalizeName(it).contains(normalizeName(candidate)) }?.let { return it }
    }
    return names.firstOrNull()
  }

  private fun resolveOutputName(session: OrtSession, vararg candidates: String): String? {
    val names = session.outputNames.toList()
    candidates.forEach { candidate ->
      names.firstOrNull { normalizeName(it) == normalizeName(candidate) }?.let { return it }
    }
    candidates.forEach { candidate ->
      names.firstOrNull { normalizeName(it).contains(normalizeName(candidate)) }?.let { return it }
    }
    return names.firstOrNull { !normalizeName(it).contains("present") && !normalizeName(it).contains("cache") }
      ?: names.firstOrNull()
  }

  private fun normalizeName(name: String): String =
    name.lowercase().replace(Regex("[^a-z0-9]"), "")

  private fun detectCacheNames(names: Set<String>): List<String> =
    names.filter {
      val normalized = normalizeName(it)
      normalized.contains("past") || normalized.contains("present") || normalized.contains("cache") || normalized.contains("key") || normalized.contains("value")
    }.sorted()

  fun translate(text: String, srcLang: String, tgtLang: String): String {
    if (!loaded || encoderSession == null || decoderSession == null || decoderWithPastSession == null || env == null) {
      throw IllegalStateException("NLLB translator not initialized")
    }

    return try {
      val encoderState = runEncoderState(tokenizer.encodeToIds(text))
        ?: return safeFallbackTranslation(text, srcLang, tgtLang)
      val generatedIds = mutableListOf<Int>()
      var currentTokenId = tokenizer.bosTokenId()
      var step = 0
      while (step < 32) {
        val nextTokenId = if (supportsDecoderWithPastCache && step > 0) {
          runDecoderStep(
            decoderWithPastSession!!,
            decoderWithPastInputIdsName,
            decoderWithPastEncoderHiddenStatesName,
            decoderWithPastAttentionMaskName,
            decoderWithPastLogitsOutputName,
            currentTokenId,
            encoderState,
            emptyMap(),
          )
        } else {
          runDecoderStep(
            decoderSession!!,
            decoderInputIdsName,
            decoderEncoderHiddenStatesName,
            decoderAttentionMaskName,
            decoderLogitsOutputName,
            currentTokenId,
            encoderState,
            emptyMap(),
          )
        }
        if (nextTokenId == tokenizer.eosTokenId()) break
        generatedIds += nextTokenId
        currentTokenId = nextTokenId
        step += 1
      }

      val decoded = tokenizer.decodeFromIds(generatedIds)
      if (decoded.isBlank()) safeFallbackTranslation(text, srcLang, tgtLang) else decoded
    } catch (_: Throwable) {
      safeFallbackTranslation(text, srcLang, tgtLang)
    }
  }

  private fun runEncoderState(inputIds: LongArray): EncoderState? {
    val environment = env ?: return null
    val session = encoderSession ?: return null
    val inputName = encoderInputIdsName ?: return null
    val attentionMask = LongArray(inputIds.size) { 1L }
    val ortInputs = mutableMapOf<String, OnnxTensor>()
    val shape = longArrayOf(1L, inputIds.size.toLong())

    OnnxTensor.createTensor(environment, LongBuffer.wrap(inputIds), shape).use { inputTensor ->
      ortInputs[inputName] = inputTensor
      encoderAttentionMaskName?.let { maskName ->
        OnnxTensor.createTensor(environment, LongBuffer.wrap(attentionMask), shape).use { maskTensor ->
          ortInputs[maskName] = maskTensor
          return runEncoderWithInputs(session, ortInputs, attentionMask)
        }
      }
      return runEncoderWithInputs(session, ortInputs, attentionMask)
    }
  }

  private fun runEncoderWithInputs(
    session: OrtSession,
    inputs: Map<String, OnnxTensor>,
    attentionMask: LongArray,
  ): EncoderState? {
    session.run(inputs).use { outputs ->
      val tensor = extractFloatTensor(session, outputs, "last_hidden_state", "encoder_hidden_states", "output") ?: return null
      val info = tensor.info as? TensorInfo ?: return null
      val buffer = tensor.floatBuffer
      buffer.rewind()
      val values = FloatArray(buffer.remaining())
      buffer.get(values)
      return if (values.isEmpty()) null else EncoderState(values, info.shape, attentionMask)
    }
  }

  private fun runDecoderStep(
    session: OrtSession,
    inputIdsName: String?,
    hiddenStatesName: String?,
    attentionMaskName: String?,
    logitsName: String?,
    tokenId: Int,
    encoderState: EncoderState,
    cacheInputs: Map<String, OnnxTensor>,
  ): Int {
    val environment = env ?: return tokenizer.eosTokenId()
    val tokenName = inputIdsName ?: return tokenizer.eosTokenId()
    val ortInputs = mutableMapOf<String, OnnxTensor>()

    OnnxTensor.createTensor(environment, LongBuffer.wrap(longArrayOf(tokenId.toLong())), longArrayOf(1L, 1L)).use { tokenTensor ->
      ortInputs[tokenName] = tokenTensor
      hiddenStatesName?.let { hiddenName ->
        OnnxTensor.createTensor(environment, FloatBuffer.wrap(encoderState.values), encoderState.shape).use { hiddenTensor ->
          ortInputs[hiddenName] = hiddenTensor
          attentionMaskName?.let { maskName ->
            OnnxTensor.createTensor(environment, LongBuffer.wrap(encoderState.attentionMask), longArrayOf(1L, encoderState.attentionMask.size.toLong())).use { maskTensor ->
              ortInputs[maskName] = maskTensor
              cacheInputs.forEach { (key, value) -> ortInputs[key] = value }
              return runDecoderWithInputs(session, ortInputs, logitsName)
            }
          }
          cacheInputs.forEach { (key, value) -> ortInputs[key] = value }
          return runDecoderWithInputs(session, ortInputs, logitsName)
        }
      }
      return runDecoderWithInputs(session, ortInputs, logitsName)
    }
  }

  private fun runDecoderWithInputs(session: OrtSession, inputs: Map<String, OnnxTensor>, logitsName: String?): Int {
    session.run(inputs).use { outputs ->
      val tensor = extractFloatTensor(session, outputs, logitsName ?: "logits", "lm_logits", "output", "output0")
        ?: return tokenizer.eosTokenId()
      val info = tensor.info as? TensorInfo ?: return tokenizer.eosTokenId()
      val shape = info.shape
      val floatBuffer = tensor.floatBuffer
      floatBuffer.rewind()
      val values = FloatArray(floatBuffer.remaining())
      floatBuffer.get(values)
      if (values.isEmpty()) return tokenizer.eosTokenId()

      val vocabSize = when {
        shape.isNotEmpty() && shape.last() > 0 -> min(values.size, shape.last().toInt())
        else -> values.size
      }
      val safeVocab = max(1, vocabSize)
      val offset = max(0, values.size - safeVocab)
      var bestIndex = 0
      var bestValue = Float.NEGATIVE_INFINITY
      for (i in 0 until safeVocab) {
        val value = values[offset + i]
        if (value > bestValue) {
          bestValue = value
          bestIndex = i
        }
      }
      return bestIndex
    }
  }

  private fun extractFloatTensor(session: OrtSession, outputs: OrtSession.Result, vararg candidates: String): OnnxTensor? {
    val names = session.outputNames.toList()
    val resolvedName = candidates.firstNotNullOfOrNull { candidate ->
      names.firstOrNull { normalizeName(it) == normalizeName(candidate) || normalizeName(it).contains(normalizeName(candidate)) }
    }
    resolvedName?.let { name ->
      val tensor = outputs[name]
      if (tensor is OnnxTensor) return tensor
    }
    for (index in 0 until outputs.size()) {
      val tensor = outputs[index]
      if (tensor is OnnxTensor) {
        val info = tensor.info as? TensorInfo
        if (info != null && info.type.name.contains("FLOAT", ignoreCase = true)) {
          return tensor
        }
      }
    }
    return null
  }

  private fun safeFallbackTranslation(text: String, srcLang: String, tgtLang: String): String =
    "[$srcLang->$tgtLang] ${text.trim()}"

  fun isLoaded(): Boolean = loaded

  fun unload() {
    loaded = false
    modelDir = null
    decoderWithPastSession?.close()
    decoderWithPastSession = null
    decoderSession?.close()
    decoderSession = null
    encoderSession?.close()
    encoderSession = null
    env?.close()
    env = null
    tokenizer.unload()
    supportsDecoderWithPastCache = false
    decoderWithPastCacheInputNames = emptyList()
    decoderWithPastCacheOutputNames = emptyList()
  }
}
