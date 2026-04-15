package com.vibevoicenative.speaker

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * React Package for Speaker Embedding Native Module
 *
 * Provides on-device speaker diarization capabilities through the
 * sherpa-onnx speaker embedding extractor C API.
 */
class SpeakerEmbeddingPackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(SpeakerEmbeddingModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}