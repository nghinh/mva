import UIKit
import React

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let bridge = appDelegate.bridge else { return }

    let rootView = RCTRootView(bridge: bridge, moduleName: "vibevoice", initialProperties: nil)
    rootView.frame = UIScreen.main.bounds
    rootView.backgroundColor = UIColor.black

    let rootViewController = UIViewController()
    rootViewController.view = rootView

    let window = UIWindow(windowScene: windowScene)
    window.rootViewController = rootViewController
    self.window = window
    window.makeKeyAndVisible()
  }
}
