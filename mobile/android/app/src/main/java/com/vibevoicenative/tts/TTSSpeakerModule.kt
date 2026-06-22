package com.vibevoicenative.tts

import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

@ReactModule(name = TTSSpeakerModule.NAME)
class TTSSpeakerModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  companion object {
    const val NAME = "TTSSpeakerModule"
    private const val EVENT_STARTED = "tts_started"
    private const val EVENT_FINISHED = "tts_finished"
  }

  private var tts: TextToSpeech? = null
  private var isReady = false
  private val isBusy = AtomicBoolean(false)
  private val utteranceCounter = AtomicInteger(0)
  private val queue = ArrayDeque<Triple<String, String, Float>>()
  private val audioManager = reactContext.getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
  private var focusRequest: AudioFocusRequest? = null

  init {
    tts = TextToSpeech(reactContext.applicationContext, this)
  }

  override fun getName(): String = NAME

  // Called by Android when TTS engine finishes initializing
  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      isReady = true
      tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
          emitEvent(EVENT_STARTED)
        }
        override fun onDone(utteranceId: String?) {
          emitEvent(EVENT_FINISHED)
          UiThreadUtil.runOnUiThread { drainQueue() }
        }
        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
          UiThreadUtil.runOnUiThread {
            isBusy.set(false)
            abandonAudioFocus()
            drainQueue()
          }
        }
      })
      // Drain any speak() calls that arrived before init completed
      UiThreadUtil.runOnUiThread { drainQueue() }
    }
  }

  @ReactMethod
  fun speak(text: String, language: String, rate: Float) {
    UiThreadUtil.runOnUiThread {
      queue.addLast(Triple(text, language, rate))
      if (!isBusy.get() && isReady) {
        drainQueue()
      }
    }
  }

  @ReactMethod
  fun stopAndClear(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      queue.clear()
      isBusy.set(false)
      tts?.stop()
      abandonAudioFocus()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun isSpeaking(promise: Promise) {
    promise.resolve(isBusy.get())
  }

  @ReactMethod
  fun checkLanguageAvailable(language: String, promise: Promise) {
    val locale = toLocale(language)
    val result = tts?.isLanguageAvailable(locale) ?: TextToSpeech.LANG_NOT_SUPPORTED
    promise.resolve(result >= TextToSpeech.LANG_AVAILABLE)
  }

  private fun drainQueue() {
    if (queue.isEmpty()) {
      isBusy.set(false)
      abandonAudioFocus()
      return
    }
    isBusy.set(true)
    val (text, language, rate) = queue.removeFirst()
    speakItem(text, language, rate)
  }

  private fun speakItem(text: String, language: String, rate: Float) {
    val ttsEngine = tts ?: run {
      isBusy.set(false)
      return
    }
    val locale = toLocale(language)
    val available = ttsEngine.isLanguageAvailable(locale)
    if (available >= TextToSpeech.LANG_AVAILABLE) {
      ttsEngine.language = locale
    }
    ttsEngine.setSpeechRate(toAndroidRate(rate))

    requestAudioFocus()

    val utteranceId = "utt_${utteranceCounter.incrementAndGet()}"
    val params = Bundle()
    params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)

    ttsEngine.speak(text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)
  }

  private fun requestAudioFocus() {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ASSISTANT)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
    focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(attrs)
      .setWillPauseWhenDucked(false)
      .build()
    focusRequest?.let { audioManager.requestAudioFocus(it) }
  }

  private fun abandonAudioFocus() {
    focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
    focusRequest = null
  }

  private fun emitEvent(eventName: String) {
    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, null)
  }

  private fun toLocale(lang: String): Locale = when (lang.lowercase()) {
    "vi" -> Locale("vi", "VN")
    "en" -> Locale.US
    "ja" -> Locale.JAPAN
    "ko" -> Locale.KOREA
    "zh" -> Locale.CHINA
    else -> Locale(lang)
  }

  // Map iOS-scale float rates (0.42/0.52/0.62) to Android setSpeechRate scale (1.0 = normal)
  private fun toAndroidRate(rate: Float): Float = when {
    rate < 0.45f -> 0.75f   // slow
    rate < 0.57f -> 1.0f    // normal
    else         -> 1.4f    // fast
  }

  override fun invalidate() {
    queue.clear()
    isBusy.set(false)
    tts?.shutdown()
    tts = null
    super.invalidate()
  }
}
