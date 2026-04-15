package com.vibevoicenative.speaker

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class OfflineSpeakerDiarizationPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == OfflineSpeakerDiarizationModule.NAME) OfflineSpeakerDiarizationModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      OfflineSpeakerDiarizationModule.NAME to ReactModuleInfo(
        OfflineSpeakerDiarizationModule.NAME,
        OfflineSpeakerDiarizationModule.NAME,
        false,
        false,
        true,
        false,
        true,
      ),
    )
  }
}
