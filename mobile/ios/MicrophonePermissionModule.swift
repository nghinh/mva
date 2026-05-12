import AVFoundation
import Foundation

@objc(MicrophonePermissionModule)
final class MicrophonePermissionModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc
  func checkPermission(_ resolve: @escaping (Any?) -> Void,
                       reject: @escaping (String?, String?, Error?) -> Void) {
    resolve(permissionStatus())
  }

  @objc
  func requestPermission(_ resolve: @escaping (Any?) -> Void,
                         reject: @escaping (String?, String?, Error?) -> Void) {
    let session = AVAudioSession.sharedInstance()
    switch session.recordPermission {
    case .granted:
      resolve("granted")
    case .denied:
      resolve("denied")
    case .undetermined:
      session.requestRecordPermission { granted in
        DispatchQueue.main.async {
          resolve(granted ? "granted" : "denied")
        }
      }
    @unknown default:
      resolve("unknown")
    }
  }

  private func permissionStatus() -> String {
    switch AVAudioSession.sharedInstance().recordPermission {
    case .granted:
      return "granted"
    case .denied:
      return "denied"
    case .undetermined:
      return "undetermined"
    @unknown default:
      return "unknown"
    }
  }
}
