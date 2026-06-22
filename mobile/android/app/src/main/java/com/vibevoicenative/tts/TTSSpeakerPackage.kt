package com.vibevoicenative.tts

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class TTSSpeakerPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == TTSSpeakerModule.NAME) TTSSpeakerModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      TTSSpeakerModule.NAME to ReactModuleInfo(
        TTSSpeakerModule.NAME,
        TTSSpeakerModule.NAME,
        false,
        false,
        true,
        false,
        false,
      ),
    )
  }
}
