#import <UIKit/UIKit.h>

#if __has_include(<ReactCodegen/VibeVoiceSpecs/VibeVoiceSpecs.h>)
#import <ReactCodegen/VibeVoiceSpecs/VibeVoiceSpecs.h>
#elif __has_include(<ReactCodegen/VibeVoiceSpecs.h>)
#import <ReactCodegen/VibeVoiceSpecs.h>
#else
#import "VibeVoiceSpecs.h"
#endif

#import <React/RCTBridgeModule.h>
#import <ReactCommon/RCTTurboModule.h>
#import "VibeVoiceNative-Swift.h"

@interface NllbTranslatorModule : NSObject <NativeNllbTranslatorSpec>
@end

@implementation NllbTranslatorModule {
  NllbTranslatorHelper *_helper;
}

RCT_EXPORT_MODULE(NllbTranslatorModule)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _helper = [NllbTranslatorHelper new];
  }
  return self;
}

- (void)initialize:(NSString *)modelDir
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([_helper initializeWithModelDir:modelDir]));
}

- (void)translate:(NSString *)text
          srcLang:(NSString *)srcLang
          tgtLang:(NSString *)tgtLang
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  @try {
    resolve([_helper translateWithText:text srcLang:srcLang tgtLang:tgtLang error:nil]);
  } @catch (NSException *exception) {
    reject(@"nllb_error", exception.reason, nil);
  }
}

- (void)isLoaded:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  resolve(@(_helper.isLoaded));
}

- (void)unload:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [_helper unload];
  resolve(nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeNllbTranslatorSpecJSI>(params);
}

@end
