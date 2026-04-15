#import <React/RCTBridgeModule.h>

/**
 * Speaker Embedding Module Bridge
 *
 * Exposes the Swift SpeakerEmbeddingModule to React Native.
 */
@interface RCT_EXTERN_MODULE(SpeakerEmbeddingModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)modelPath
                  numThreads:(int)numThreads
                  provider:(NSString *)provider
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(extractEmbedding:(NSArray *)samples
                  sampleRate:(int)sampleRate
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getEmbeddingDim:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isReady:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(unload)

@end