package com.vibevoicenative.securestorage

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SecureStorageBridgePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == SecureStorageBridgeModule.NAME) SecureStorageBridgeModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
      SecureStorageBridgeModule.NAME to ReactModuleInfo(
        SecureStorageBridgeModule.NAME,
        SecureStorageBridgeModule.NAME,
        false,
        false,
        true,
        false,
        true,
      ),
    )
  }
}
