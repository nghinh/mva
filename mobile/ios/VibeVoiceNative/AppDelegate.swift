import UIKit
import React
import React_RCTAppDelegate

@main
class AppDelegate: RCTAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    self.moduleName = "vibevoice"
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    return URL(string: "http://192.168.1.69:8081/index.bundle?platform=ios")
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
