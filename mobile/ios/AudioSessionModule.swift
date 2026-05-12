import AVFoundation
import Foundation

@objc(AudioSessionModule)
final class AudioSessionModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc
  func activateRecordingSession(_ resolve: @escaping (Any?) -> Void,
                                reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playAndRecord,
          mode: .default,
          options: [.allowBluetooth, .defaultToSpeaker]
        )
        try session.setPreferredSampleRate(16_000)
        try session.setPreferredIOBufferDuration(0.02)
        try session.setActive(true, options: [])
        resolve(true)
      } catch {
        reject("audio_session_activation_failed", error.localizedDescription, error)
      }
    }
  }

  @objc
  func deactivateRecordingSession(_ resolve: @escaping (Any?) -> Void,
                                  reject: @escaping (String?, String?, Error?) -> Void) {
    DispatchQueue.main.async {
      do {
        try AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
        resolve(true)
      } catch {
        reject("audio_session_deactivation_failed", error.localizedDescription, error)
      }
    }
  }
}
