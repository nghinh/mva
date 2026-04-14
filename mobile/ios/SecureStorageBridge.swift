import Foundation
import Security
import CryptoKit

@objc(SecureStorageBridge)
final class SecureStorageBridge: NSObject {
  private let service = "com.vnteki.mva.securestorage"
  private let account = "storage-key"

  @objc
  func encrypt(_ plaintext: String,
               resolve: @escaping (Any?) -> Void,
               reject: @escaping (String?, String?, Error?) -> Void) {
    do {
      let key = try loadOrCreateKey()
      let sealedBox = try AES.GCM.seal(Data(plaintext.utf8), using: key)
      guard let combined = sealedBox.combined else {
        reject("secure_storage_encrypt_failed", "Failed to create encrypted payload", nil)
        return
      }
      resolve(combined.base64EncodedString())
    } catch {
      reject("secure_storage_encrypt_failed", error.localizedDescription, error)
    }
  }

  @objc
  func decrypt(_ payload: String,
               resolve: @escaping (Any?) -> Void,
               reject: @escaping (String?, String?, Error?) -> Void) {
    do {
      let key = try loadOrCreateKey()
      guard let data = Data(base64Encoded: payload) else {
        reject("secure_storage_decrypt_failed", "Invalid encrypted payload", nil)
        return
      }
      let sealedBox = try AES.GCM.SealedBox(combined: data)
      let plaintext = try AES.GCM.open(sealedBox, using: key)
      resolve(String(decoding: plaintext, as: UTF8.self))
    } catch {
      reject("secure_storage_decrypt_failed", error.localizedDescription, error)
    }
  }

  private func loadOrCreateKey() throws -> SymmetricKey {
    if let existing = try loadKeyData() {
      return SymmetricKey(data: existing)
    }
    let key = SymmetricKey(size: .bits256)
    let data = key.withUnsafeBytes { Data(Array($0)) }
    try saveKeyData(data)
    return key
  }

  private func loadKeyData() throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess else {
      throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
    }
    return item as? Data
  }

  private func saveKeyData(_ data: Data) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
    ]
    let status = SecItemAdd(query as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw NSError(domain: NSOSStatusErrorDomain, code: Int(status))
    }
  }
}
