#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AudioSessionModule, NSObject)

RCT_EXTERN_METHOD(activateRecordingSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deactivateRecordingSession:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
