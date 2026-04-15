import Foundation

/**
 * Speaker Embedding Native Module
 *
 * Wraps the sherpa-onnx C API for speaker embedding extraction on iOS.
 * This enables on-device speaker diarization by extracting embedding vectors
 * from audio samples.
 *
 * The module uses the sherpa-onnx speaker embedding extractor which is available
 * in the sherpa_onnx.xcframework linked via CocoaPods.
 */
@objc(SpeakerEmbeddingModule)
class SpeakerEmbeddingModule: NSObject {

    // MARK: - Properties

    private var extractor: OpaquePointer?
    private var embeddingDim: Int32 = 0
    private let extractionQueue = DispatchQueue(label: "com.vibevoice.speaker.embedding", qos: .userInitiated)

    // MARK: - Module Setup

    @objc static func moduleName() -> String {
        return "SpeakerEmbeddingModule"
    }

    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }

    // MARK: - Public API

    /**
     * Initialize the speaker embedding extractor with a model path.
     *
     * @param modelPath Absolute path to the speaker embedding model file
     * @param numThreads Number of threads for inference
     * @param provider Execution provider ("cpu", "coreml", etc.)
     */
    @objc(initialize:numThreads:provider:resolver:rejecter:)
    func initialize(
        _ modelPath: String,
        numThreads: Int,
        provider: String,
        resolver resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String?, String?, Error?) -> Void
    ) {
        extractionQueue.async { [weak self] in
            guard let self = self else { return }

            // Configure the extractor
            var config = SherpaOnnxSpeakerEmbeddingExtractorConfig()
            let modelCString = strdup(modelPath)
            let providerCString = strdup(provider)
            config.model = UnsafePointer(modelCString)
            config.num_threads = Int32(numThreads)
            config.debug = 0
            config.provider = UnsafePointer(providerCString)

            // Create extractor
            guard let extractor = SherpaOnnxCreateSpeakerEmbeddingExtractor(&config) else {
                free(modelCString)
                free(providerCString)
                DispatchQueue.main.async {
                    reject("INIT_ERROR", "Failed to create speaker embedding extractor", nil)
                }
                return
            }

            free(modelCString)
            free(providerCString)

            self.extractor = extractor
            self.embeddingDim = SherpaOnnxSpeakerEmbeddingExtractorDim(extractor)

            DispatchQueue.main.async {
                resolve([
                    "success": true,
                    "embeddingDim": self.embeddingDim,
                    "error": NSNull()
                ])
            }
        }
    }

    /**
     * Extract speaker embedding from audio samples.
     *
     * @param samples Array of Float audio samples (range [-1, 1])
     * @param sampleRate Sample rate in Hz (e.g., 16000)
     */
    @objc(extractEmbedding:sampleRate:resolver:rejecter:)
    func extractEmbedding(
        _ samples: [NSNumber],
        sampleRate: Int,
        resolver resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String?, String?, Error?) -> Void
    ) {
        extractionQueue.async { [weak self] in
            guard let self = self else { return }
            guard let extractor = self.extractor else {
                DispatchQueue.main.async {
                    reject("NOT_INITIALIZED", "Speaker embedding extractor not initialized", nil)
                }
                return
            }

            // Convert samples to Float array
            let floatSamples = samples.map { Float($0.floatValue) }

            // Create stream for embedding extraction
            guard let stream = SherpaOnnxSpeakerEmbeddingExtractorCreateStream(extractor) else {
                DispatchQueue.main.async {
                    reject("STREAM_ERROR", "Failed to create embedding stream", nil)
                }
                return
            }

            // Feed audio samples to stream
            let sampleRateInt32 = Int32(sampleRate)
            let numSamples = Int32(floatSamples.count)
            SherpaOnnxOnlineStreamAcceptWaveform(stream, sampleRateInt32, floatSamples, numSamples)
            SherpaOnnxOnlineStreamInputFinished(stream)

            // Check if we have enough audio for embedding
            guard SherpaOnnxSpeakerEmbeddingExtractorIsReady(extractor, stream) == 1 else {
              SherpaOnnxDestroyOnlineStream(stream)
                DispatchQueue.main.async {
                    reject("NOT_READY", "Not enough audio samples for embedding extraction", nil)
                }
                return
            }

            // Compute embedding
            guard let embeddingPtr = SherpaOnnxSpeakerEmbeddingExtractorComputeEmbedding(extractor, stream) else {
                SherpaOnnxDestroyOnlineStream(stream)
                DispatchQueue.main.async {
                    reject("EXTRACTION_ERROR", "Failed to compute embedding", nil)
                }
                return
            }

            // Copy embedding to Swift array
            var embedding = [Float](repeating: 0, count: Int(self.embeddingDim))
            for i in 0..<Int(self.embeddingDim) {
                embedding[i] = embeddingPtr.advanced(by: i).pointee
            }

            // Clean up
            SherpaOnnxSpeakerEmbeddingExtractorDestroyEmbedding(embeddingPtr)
            SherpaOnnxDestroyOnlineStream(stream)

            // Convert to NSNumber array and resolve
            let result = embedding.map { NSNumber(value: $0) }
            DispatchQueue.main.async {
                resolve(result)
            }
        }
    }

    /**
     * Get the embedding dimension for the loaded model.
     */
    @objc(getEmbeddingDim:rejecter:)
    func getEmbeddingDim(
        _ resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String?, String?, Error?) -> Void
    ) {
        guard extractor != nil else {
            reject("NOT_INITIALIZED", "Speaker embedding extractor not initialized", nil)
            return
        }
        resolve(embeddingDim)
    }

    /**
     * Check if the extractor is initialized and ready.
     */
    @objc(isReady:rejecter:)
    func isReady(
        _ resolve: @escaping (Any?) -> Void,
        rejecter reject: @escaping (String?, String?, Error?) -> Void
    ) {
        resolve(extractor != nil)
    }

    /**
     * Release all resources.
     */
    @objc(unload)
    func unload() {
        extractionQueue.async { [weak self] in
            guard let self = self else { return }
            if let extractor = self.extractor {
                SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor)
                self.extractor = nil
            }
            self.embeddingDim = 0
        }
    }

    deinit {
        if let extractor = extractor {
            SherpaOnnxDestroySpeakerEmbeddingExtractor(extractor)
        }
    }
}
