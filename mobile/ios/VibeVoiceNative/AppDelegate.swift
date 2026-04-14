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
    #if targetEnvironment(simulator)
    return URL(string: "http://localhost:8081/index.bundle?platform=ios")
    #else
    let metroHost = Bundle.main.object(forInfoDictionaryKey: "MetroHost") as? String ?? "localhost"
    return URL(string: "http://\(metroHost):8081/index.bundle?platform=ios")
    #endif
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
