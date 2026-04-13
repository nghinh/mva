package com.vibevoicenative.nllb

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class NllbTranslatorPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NllbTranslatorModule.NAME) NllbTranslatorModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      NllbTranslatorModule.NAME to ReactModuleInfo(
        NllbTranslatorModule.NAME,
        NllbTranslatorModule.NAME,
        false,
        false,
        true,
        false,
        true,
      )
    )
  }
}
