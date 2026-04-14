package com.vibevoicenative.securestorage

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@ReactModule(name = SecureStorageBridgeModule.NAME)
class SecureStorageBridgeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TurboModule {

  override fun getName(): String = NAME

  @ReactMethod
  fun encrypt(plaintext: String, promise: Promise) {
    try {
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
      val iv = cipher.iv
      val encrypted = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
      val payload =
        Base64.encodeToString(iv, Base64.NO_WRAP) + ":" +
          Base64.encodeToString(encrypted, Base64.NO_WRAP)
      promise.resolve(payload)
    } catch (error: Exception) {
      promise.reject("secure_storage_encrypt_failed", error)
    }
  }

  @ReactMethod
  fun decrypt(payload: String, promise: Promise) {
    try {
      val parts = payload.split(":", limit = 2)
      if (parts.size != 2) {
        promise.reject("secure_storage_decrypt_failed", "Invalid encrypted payload")
        return
      }

      val iv = Base64.decode(parts[0], Base64.NO_WRAP)
      val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, getOrCreateSecretKey(), GCMParameterSpec(128, iv))
      val decrypted = cipher.doFinal(ciphertext)
      promise.resolve(String(decrypted, StandardCharsets.UTF_8))
    } catch (error: Exception) {
      promise.reject("secure_storage_decrypt_failed", error)
    }
  }

  private fun getOrCreateSecretKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    val existing = keyStore.getKey(KEY_ALIAS, null) as? SecretKey
    if (existing != null) {
      return existing
    }

    val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
    val spec = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setKeySize(256)
      .build()
    keyGenerator.init(spec)
    return keyGenerator.generateKey()
  }

  companion object {
    const val NAME = "SecureStorageBridge"
    private const val KEY_ALIAS = "vibevoice_secure_storage_key"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
  }
}
