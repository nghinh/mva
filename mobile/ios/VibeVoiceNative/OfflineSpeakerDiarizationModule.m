#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OfflineSpeakerDiarizationModule, NSObject)

RCT_EXTERN_METHOD(initialize:(NSString *)segmentationModelPath
                  embeddingModelPath:(NSString *)embeddingModelPath
                  segmentationThreads:(NSInteger)segmentationThreads
                  embeddingThreads:(NSInteger)embeddingThreads
                  threshold:(double)threshold
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(process:(NSArray<NSNumber *> *)samples
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateThreshold:(double)threshold
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(unload)

@end
