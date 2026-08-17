package com.vibevoicenative.translation

import com.facebook.react.bridge.*
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.nl.translate.*
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await

class MLKitTranslatorModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MLKitTranslator"

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val translators = mutableMapOf<String, Translator>()

    private val langMap = mapOf(
        "en" to TranslateLanguage.ENGLISH,
        "ja" to TranslateLanguage.JAPANESE,
        "ko" to TranslateLanguage.KOREAN,
        "zh" to TranslateLanguage.CHINESE,
        "vi" to TranslateLanguage.VIETNAMESE
    )

    @ReactMethod
    fun translate(text: String, srcLang: String, tgtLang: String, promise: Promise) {
        if (srcLang == "vi") {
            promise.resolve(text)
            return
        }

        val srcCode = langMap[srcLang]
        val tgtCode = langMap[tgtLang]
        if (srcCode == null || tgtCode == null) {
            promise.reject("INVALID_LANG", "Unsupported language pair: $srcLang→$tgtLang")
            return
        }

        scope.launch {
            try {
                val translator = getOrCreateTranslator(srcCode, tgtCode)
                translator.downloadModelIfNeeded().await()
                val result = translator.translate(text).await()
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("TRANSLATE_ERROR", "Translation failed: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun translateBatch(texts: ReadableArray, srcLang: String, tgtLang: String, promise: Promise) {
        if (srcLang == "vi") {
            promise.resolve(texts)
            return
        }

        val srcCode = langMap[srcLang]
        val tgtCode = langMap[tgtLang]
        if (srcCode == null || tgtCode == null) {
            promise.reject("INVALID_LANG", "Unsupported language pair: $srcLang→$tgtLang")
            return
        }

        scope.launch {
            try {
                val translator = getOrCreateTranslator(srcCode, tgtCode)
                translator.downloadModelIfNeeded().await()
                val results = WritableNativeArray()
                for (i in 0 until texts.size()) {
                    val text = texts.getString(i)
                    if (text != null) {
                        val result = translator.translate(text).await()
                        results.pushString(result)
                    } else {
                        results.pushString("")
                    }
                }
                promise.resolve(results)
            } catch (e: Exception) {
                promise.reject("TRANSLATE_ERROR", "Batch translation failed: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun isLanguageAvailable(srcLang: String, tgtLang: String, promise: Promise) {
        val srcCode = langMap[srcLang]
        val tgtCode = langMap[tgtLang]
        if (srcCode == null || tgtCode == null) {
            promise.resolve(false)
            return
        }

        scope.launch {
            try {
                val modelManager = RemoteModelManager.getInstance()
                val srcModel = TranslateRemoteModel.Builder(srcCode).build()
                val tgtModel = TranslateRemoteModel.Builder(tgtCode).build()
                val srcReady = modelManager.isModelDownloaded(srcModel).await()
                val tgtReady = modelManager.isModelDownloaded(tgtModel).await()
                promise.resolve(srcReady && tgtReady)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    @ReactMethod
    fun downloadLanguagePack(srcLang: String, tgtLang: String, promise: Promise) {
        val srcCode = langMap[srcLang]
        val tgtCode = langMap[tgtLang]
        if (srcCode == null || tgtCode == null) {
            promise.reject("INVALID_LANG", "Unsupported language: $srcLang→$tgtLang")
            return
        }
        scope.launch {
            try {
                val translator = getOrCreateTranslator(srcCode, tgtCode)
                translator.downloadModelIfNeeded().await()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", "Pack download failed: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun downloadAllLanguagePacks(promise: Promise) {
        scope.launch {
            try {
                val conditions = DownloadConditions.Builder()
                    .requireWifi()
                    .build()

                val sourceLangs = listOf("en", "ja", "ko", "zh")
                for (src in sourceLangs) {
                    val translator = getOrCreateTranslator(langMap[src]!!, langMap["vi"]!!)
                    translator.downloadModelIfNeeded(conditions).await()
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_ERROR", "Pack download failed: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun getPackStatus(promise: Promise) {
        scope.launch {
            try {
                val modelManager = RemoteModelManager.getInstance()
                val result = WritableNativeMap()
                for ((code, mlkitCode) in langMap) {
                    if (code == "vi") continue
                    val srcModel = TranslateRemoteModel.Builder(mlkitCode).build()
                    val tgtModel = TranslateRemoteModel.Builder(langMap["vi"]!!).build()
                    val srcReady = modelManager.isModelDownloaded(srcModel).await()
                    val tgtReady = modelManager.isModelDownloaded(tgtModel).await()
                    result.putBoolean("${code}-vi", srcReady && tgtReady)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("STATUS_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun deleteAllPacks(promise: Promise) {
        scope.launch {
            try {
                val modelManager = RemoteModelManager.getInstance()
                val models = modelManager.getDownloadedModels(TranslateRemoteModel::class.java).await()
                for (model in models) {
                    modelManager.deleteDownloadedModel(model).await()
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DELETE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun cleanup() {
        translators.values.forEach { it.close() }
        translators.clear()
    }

    private fun getOrCreateTranslator(srcCode: String, tgtCode: String): Translator {
        val key = "$srcCode-$tgtCode"
        return translators.getOrPut(key) {
            val options = TranslatorOptions.Builder()
                .setSourceLanguage(srcCode)
                .setTargetLanguage(tgtCode)
                .build()
            Translation.getClient(options)
        }
    }
}