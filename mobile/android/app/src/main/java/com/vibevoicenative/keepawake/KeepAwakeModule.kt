package com.vibevoicenative.keepawake

import android.view.WindowManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = KeepAwakeModule.NAME)
class KeepAwakeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun activateKeepAwake(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.currentActivity?.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun deactivateKeepAwake(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.currentActivity?.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      promise.resolve(true)
    }
  }

  companion object {
    const val NAME = "KeepAwakeModule"
  }
}
