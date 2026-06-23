package com.vibevoicenative.speaker

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@ReactModule(name = SpeakerEmbeddingModule.NAME)
class SpeakerEmbeddingModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val moduleScope = CoroutineScope(Dispatchers.IO)
    private var isLoaded = false
    private var embeddingDim = 0

    override fun getName(): String = NAME

    @ReactMethod
    fun initialize(modelPath: String, numThreads: Int, provider: String, promise: Promise) {
        moduleScope.launch {
            try {
                val success = initializeNative(modelPath, numThreads, provider)
                if (success) {
                    isLoaded = true
                    embeddingDim = getEmbeddingDimNative()
                    val result = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putInt("embeddingDim", embeddingDim)
                        putNull("error")
                    }
                    promise.resolve(result)
                } else {
                    promise.reject("INIT_ERROR", "Failed to initialize speaker embedding extractor")
                }
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun extractEmbedding(samples: ReadableArray, sampleRate: Int, promise: Promise) {
        if (!isLoaded) {
            promise.reject("NOT_INITIALIZED", "Speaker embedding extractor not initialized. Call initialize() first.")
            return
        }

        moduleScope.launch {
            try {
                val sampleList = FloatArray(samples.size()) { samples.getDouble(it).toFloat() }
                val embedding = extractEmbeddingNative(sampleList, sampleRate)
                if (embedding == null) {
                    promise.reject("EXTRACTION_ERROR", "Failed to extract embedding - not enough audio")
                    return@launch
                }
                val readableEmbedding = Arguments.createArray().apply {
                    embedding.forEach { pushDouble(it.toDouble()) }
                }
                promise.resolve(readableEmbedding)
            } catch (e: Exception) {
                promise.reject("EXTRACTION_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getEmbeddingDim(promise: Promise) {
        if (!isLoaded) {
            promise.reject("NOT_INITIALIZED", "Speaker embedding extractor not initialized")
            return
        }
        promise.resolve(embeddingDim)
    }

    @ReactMethod
    fun isReady(promise: Promise) {
        promise.resolve(isLoaded)
    }

    @ReactMethod
    fun unload() {
        unloadNative()
        isLoaded = false
        embeddingDim = 0
    }

    private external fun initializeNative(modelPath: String, numThreads: Int, provider: String): Boolean
    private external fun extractEmbeddingNative(samples: FloatArray, sampleRate: Int): FloatArray?
    private external fun getEmbeddingDimNative(): Int
    private external fun unloadNative()

    companion object {
        const val NAME = "SpeakerEmbeddingModule"

        init {
            System.loadLibrary("appmodules")
        }
    }
}
