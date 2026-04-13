package com.vibevoiceclean.nllb

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule

@ReactModule(name = NllbTranslatorModule.NAME)
class NllbTranslatorModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TurboModule {

  private val helper = NllbTranslatorHelper(reactContext)

  override fun getName(): String = NAME

  @ReactMethod
  fun initialize(modelDir: String, promise: Promise) {
    promise.resolve(helper.initialize(modelDir))
  }

  @ReactMethod
  fun translate(text: String, srcLang: String, tgtLang: String, promise: Promise) {
    promise.resolve(helper.translate(text, srcLang, tgtLang))
  }

  @ReactMethod
  fun isLoaded(promise: Promise) {
    promise.resolve(helper.isLoaded())
  }

  @ReactMethod
  fun unload(promise: Promise) {
    helper.unload()
    promise.resolve(null)
  }

  companion object {
    const val NAME = "NllbTranslatorModule"
  }
}
