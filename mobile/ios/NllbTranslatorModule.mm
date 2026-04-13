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
#import <React-RCTAppDelegate/RCTAppDelegate.h>
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
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_BACKGROUND, 0), ^{
    BOOL ok = [self->_helper initializeWithModelDir:modelDir];
    resolve(@(ok));
  });
}

- (void)translate:(NSString *)text
          srcLang:(NSString *)srcLang
          tgtLang:(NSString *)tgtLang
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    @try {
      NSError *error = nil;
      NSString *result = [self->_helper translateWithText:text srcLang:srcLang tgtLang:tgtLang error:&error];
      if (error) {
        reject(@"nllb_error", error.localizedDescription, error);
      } else {
        resolve(result);
      }
    } @catch (NSException *exception) {
      reject(@"nllb_error", exception.reason, nil);
    }
  });
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
