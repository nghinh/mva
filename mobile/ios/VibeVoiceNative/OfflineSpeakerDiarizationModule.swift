import Foundation

@objc(OfflineSpeakerDiarizationModule)
class OfflineSpeakerDiarizationModule: NSObject {
  private var diarizer: OpaquePointer?
  private var lastConfig = SherpaOnnxOfflineSpeakerDiarizationConfig()
  private let queue = DispatchQueue(label: "com.vibevoice.offline-speaker-diarization", qos: .userInitiated)
  private var segmentationModelPath: String?
  private var embeddingModelPath: String?
  private let provider = "cpu"

  private func makeConfig(threshold: Double, segmentationThreads: Int = 2, embeddingThreads: Int = 2) -> SherpaOnnxOfflineSpeakerDiarizationConfig {
    var config = SherpaOnnxOfflineSpeakerDiarizationConfig()
    config.segmentation.pyannote.model = UnsafePointer(strdup(segmentationModelPath ?? ""))
    config.segmentation.num_threads = Int32(segmentationThreads)
    config.segmentation.debug = 0
    config.segmentation.provider = UnsafePointer(strdup(provider))

    config.embedding.model = UnsafePointer(strdup(embeddingModelPath ?? ""))
    config.embedding.num_threads = Int32(embeddingThreads)
    config.embedding.debug = 0
    config.embedding.provider = UnsafePointer(strdup(provider))

    config.clustering.num_clusters = 0
    config.clustering.threshold = Float(threshold)
    config.min_duration_on = 0.20
    config.min_duration_off = 0.15
    return config
  }

  private func freeConfig(_ config: inout SherpaOnnxOfflineSpeakerDiarizationConfig) {
    if let p = config.segmentation.pyannote.model { free(UnsafeMutableRawPointer(mutating: p)) }
    if let p = config.segmentation.provider { free(UnsafeMutableRawPointer(mutating: p)) }
    if let p = config.embedding.model { free(UnsafeMutableRawPointer(mutating: p)) }
    if let p = config.embedding.provider { free(UnsafeMutableRawPointer(mutating: p)) }
    memset(&config, 0, MemoryLayout<SherpaOnnxOfflineSpeakerDiarizationConfig>.size)
  }

  @objc static func moduleName() -> String { "OfflineSpeakerDiarizationModule" }
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(initialize:embeddingModelPath:segmentationThreads:embeddingThreads:threshold:resolver:rejecter:)
  func initialize(
    _ segmentationModelPath: String,
    embeddingModelPath: String,
    segmentationThreads: Int,
    embeddingThreads: Int,
    threshold: Double,
    resolver resolve: @escaping (Any?) -> Void,
    rejecter reject: @escaping (String?, String?, Error?) -> Void
  ) {
    queue.async { [weak self] in
      guard let self = self else { return }

      if let diarizer = self.diarizer {
        SherpaOnnxDestroyOfflineSpeakerDiarization(diarizer)
        self.diarizer = nil
      }

      self.segmentationModelPath = segmentationModelPath
      self.embeddingModelPath = embeddingModelPath
      var config = self.makeConfig(threshold: threshold, segmentationThreads: segmentationThreads, embeddingThreads: embeddingThreads)

      let diarizer = SherpaOnnxCreateOfflineSpeakerDiarization(&config)

      guard let diarizer else {
        self.freeConfig(&config)
        DispatchQueue.main.async {
          reject("INIT_ERROR", "Failed to create offline speaker diarizer", nil)
        }
        return
      }

      self.diarizer = diarizer
      self.lastConfig = config
      let sampleRate = SherpaOnnxOfflineSpeakerDiarizationGetSampleRate(diarizer)
      DispatchQueue.main.async {
        resolve(["success": true, "sampleRate": sampleRate])
      }
    }
  }

  @objc(process:resolver:rejecter:)
  func process(
    _ samples: [NSNumber],
    resolver resolve: @escaping (Any?) -> Void,
    rejecter reject: @escaping (String?, String?, Error?) -> Void
  ) {
    queue.async { [weak self] in
      guard let self = self else { return }
      guard let diarizer = self.diarizer else {
        DispatchQueue.main.async { reject("NOT_INITIALIZED", "Offline diarizer not initialized", nil) }
        return
      }

      autoreleasepool {
        let pcm = samples.map { Float($0.floatValue) }
        guard pcm.count <= 16000 * 6 else {
          DispatchQueue.main.async { resolve(["numSpeakers": 0, "segments": []]) }
          return
        }

        guard let result = SherpaOnnxOfflineSpeakerDiarizationProcess(diarizer, pcm, Int32(pcm.count)) else {
          DispatchQueue.main.async { reject("PROCESS_ERROR", "Failed to run offline speaker diarization", nil) }
          return
        }

        let numSegments = Int(SherpaOnnxOfflineSpeakerDiarizationResultGetNumSegments(result))
        let numSpeakers = Int(SherpaOnnxOfflineSpeakerDiarizationResultGetNumSpeakers(result))
        let sortedSegments = SherpaOnnxOfflineSpeakerDiarizationResultSortByStartTime(result)

        var payload: [[String: Any]] = []
        if let sortedSegments {
          for i in 0..<numSegments {
            let seg = sortedSegments.advanced(by: i).pointee
            payload.append([
              "startSec": seg.start,
              "endSec": seg.end,
              "speaker": seg.speaker,
            ])
          }
          SherpaOnnxOfflineSpeakerDiarizationDestroySegment(sortedSegments)
        }

        SherpaOnnxOfflineSpeakerDiarizationDestroyResult(result)
        DispatchQueue.main.async {
          resolve(["numSpeakers": numSpeakers, "segments": payload])
        }
      }
    }
  }

  @objc(updateThreshold:resolver:rejecter:)
  func updateThreshold(
    _ threshold: Double,
    resolver resolve: @escaping (Any?) -> Void,
    rejecter reject: @escaping (String?, String?, Error?) -> Void
  ) {
    queue.async { [weak self] in
      guard let self = self else { return }
      guard let diarizer = self.diarizer else {
        DispatchQueue.main.async { reject("NOT_INITIALIZED", "Offline diarizer not initialized", nil) }
        return
      }

      var config = self.makeConfig(threshold: threshold)
      SherpaOnnxOfflineSpeakerDiarizationSetConfig(diarizer, &config)
      self.freeConfig(&self.lastConfig)
      self.lastConfig = config
      DispatchQueue.main.async { resolve(true) }
    }
  }

  @objc(unload)
  func unload() {
    queue.async { [weak self] in
      guard let self = self else { return }
      if let diarizer = self.diarizer {
        SherpaOnnxDestroyOfflineSpeakerDiarization(diarizer)
        self.diarizer = nil
      }
      self.freeConfig(&self.lastConfig)
    }
  }
}
