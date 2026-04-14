#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SecureStorageBridge, NSObject)

RCT_EXTERN_METHOD(encrypt:(NSString *)plaintext
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(decrypt:(NSString *)payload
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject)

@end
