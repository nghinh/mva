package com.vibevoicenative.speaker

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule

@ReactModule(name = OfflineSpeakerDiarizationModule.NAME)
class OfflineSpeakerDiarizationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TurboModule {

  override fun getName(): String = NAME

  @ReactMethod
  fun initialize(
    segmentationModelPath: String,
    embeddingModelPath: String,
    segmentationThreads: Int,
    embeddingThreads: Int,
    threshold: Double,
    promise: Promise,
  ) {
    try {
      val sampleRate = initializeNative(
        segmentationModelPath,
        embeddingModelPath,
        segmentationThreads,
        embeddingThreads,
        threshold.toFloat(),
      )
      promise.resolve(mapOf("success" to (sampleRate > 0), "sampleRate" to if (sampleRate > 0) sampleRate else 16000))
    } catch (e: Exception) {
      promise.reject("INIT_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun process(samples: ReadableArray, promise: Promise) {
    try {
      val pcm = FloatArray(samples.size()) { samples.getDouble(it).toFloat() }
      val flat = processNative(pcm)
      if (flat == null) {
        promise.reject("PROCESS_ERROR", "Offline diarization returned null result")
        return
      }
      if (flat.size % 3 != 0) {
        promise.reject("CORRUPT_DATA", "Segment data size not divisible by 3")
        return
      }
      val segments = Arguments.createArray()
      var i = 0
      while (i + 2 < flat.size) {
        val seg = Arguments.createMap().apply {
          putDouble("startSec", flat[i].toDouble())
          putDouble("endSec", flat[i + 1].toDouble())
          putInt("speaker", flat[i + 2].toInt())
        }
        segments.pushMap(seg)
        i += 3
      }
      promise.resolve(
        Arguments.createMap().apply {
          putInt("numSpeakers", getLastNumSpeakersNative())
          putArray("segments", segments)
        }
      )
    } catch (e: Exception) {
      promise.reject("PROCESS_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun updateThreshold(threshold: Double, promise: Promise) {
    promise.resolve(updateThresholdNative(threshold.toFloat()))
  }

  @ReactMethod
  fun unload() {
    unloadNative()
  }

  private external fun initializeNative(
    segmentationModelPath: String,
    embeddingModelPath: String,
    segmentationThreads: Int,
    embeddingThreads: Int,
    threshold: Float,
  ): Int

  private external fun processNative(samples: FloatArray): FloatArray?
  private external fun getLastNumSpeakersNative(): Int
  private external fun updateThresholdNative(threshold: Float): Boolean
  private external fun unloadNative()

  companion object {
    const val NAME = "OfflineSpeakerDiarizationModule"

    init {
      System.loadLibrary("vibevoice_diarization")
    }
  }
}
