import UIKit
import React

@main
class AppDelegate: UIResponder, UIApplicationDelegate, RCTBridgeDelegate {
  var window: UIWindow?
  var bridge: RCTBridge?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    bridge = RCTBridge(delegate: self, launchOptions: launchOptions)

    guard let bridge else {
      return false
    }

    let rootView = RCTRootView(bridge: bridge, moduleName: "vibevoice", initialProperties: nil)
    rootView.frame = UIScreen.main.bounds
    rootView.backgroundColor = UIColor.black

    let rootViewController = UIViewController()
    rootViewController.view = rootView

    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = rootViewController
    window?.makeKeyAndVisible()

    return true
  }

  func sourceURL(for bridge: RCTBridge) -> URL? {
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
  }
}
