package com.vibevoicenative

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.vibevoicenative.keepawake.KeepAwakePackage
import com.vibevoicenative.securestorage.SecureStorageBridgePackage
import com.vibevoicenative.speaker.OfflineSpeakerDiarizationPackage
import com.vibevoicenative.speaker.SpeakerEmbeddingPackage
import com.vibevoicenative.translation.MLKitTranslatorPackage
import com.vibevoicenative.tts.TTSSpeakerPackage

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              add(KeepAwakePackage())
              add(SecureStorageBridgePackage())
              add(OfflineSpeakerDiarizationPackage())
              add(SpeakerEmbeddingPackage())
              add(MLKitTranslatorPackage())
              add(TTSSpeakerPackage())
            }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = true
      }

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(applicationContext, reactNativeHost)
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
