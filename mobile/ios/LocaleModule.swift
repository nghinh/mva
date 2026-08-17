import Foundation
import React

@objc(LocaleModule)
final class LocaleModule: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  // RCTBridgeModule protocol method (not an NSObject override).
  @objc func constantsToExport() -> [AnyHashable: Any]! {
    // NSLocale.preferredLanguages is the iOS system-level ordered list of user-preferred
    // languages, independent of device Region. e.g. "en-VN" for English speaker in Vietnam.
    let tag = NSLocale.preferredLanguages.first ?? ""
    // Extract ISO 639-1 language code ("en" from "en-VN", "zh" from "zh-Hans-CN")
    let code = tag.components(separatedBy: CharacterSet(charactersIn: "-_")).first ?? ""
    return ["languageCode": code]
  }
}
