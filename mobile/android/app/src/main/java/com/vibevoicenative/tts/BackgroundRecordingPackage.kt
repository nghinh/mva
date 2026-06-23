package com.vibevoicenative.tts

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BackgroundRecordingPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == BackgroundRecordingModule.NAME) BackgroundRecordingModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      BackgroundRecordingModule.NAME to ReactModuleInfo(
        BackgroundRecordingModule.NAME,
        BackgroundRecordingModule.NAME,
        false,
        false,
        true,
        false,
        false,
      ),
    )
  }
}
