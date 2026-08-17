// export rỗng: xem chú thích ở NativeBackgroundRecording.test.ts — đánh dấu file
// là module để mockPlatform không va nhau ở global scope.
export {};

// Mock NativeModules before importing the module under test
const mockSpeak = jest.fn();
const mockStopAndClear = jest.fn().mockResolvedValue(true);
const mockIsSpeaking = jest.fn().mockResolvedValue(false);
const mockCheckLanguageAvailable = jest.fn().mockResolvedValue(true);

// Shared Platform object so tests can mutate OS
const mockPlatform = {OS: 'android' as string};

jest.mock('react-native', () => ({
  NativeModules: {
    TTSSpeakerModule: {
      speak: mockSpeak,
      stopAndClear: mockStopAndClear,
      isSpeaking: mockIsSpeaking,
      checkLanguageAvailable: mockCheckLanguageAvailable,
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
  })),
  get Platform() {
    return mockPlatform;
  },
}));

describe('NativeTTSSpeaker', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
  });

  it('TTSSpeakerEmitter is non-null on Android when module exists', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {TTSSpeakerEmitter} = require('./NativeTTSSpeaker');
      expect(TTSSpeakerEmitter).not.toBeNull();
    });
  });

  it('checkAndroidTtsLanguage resolves true when language is available', async () => {
    mockCheckLanguageAvailable.mockResolvedValue(true);
    let result: boolean | undefined;
    await new Promise<void>(resolve => {
      jest.isolateModules(async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {checkAndroidTtsLanguage} = require('./NativeTTSSpeaker');
        result = await checkAndroidTtsLanguage('vi');
        resolve();
      });
    });
    expect(result).toBe(true);
    expect(mockCheckLanguageAvailable).toHaveBeenCalledWith('vi');
  });

  it('checkAndroidTtsLanguage resolves false when language is unavailable', async () => {
    mockCheckLanguageAvailable.mockResolvedValue(false);
    let result: boolean | undefined;
    await new Promise<void>(resolve => {
      jest.isolateModules(async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {checkAndroidTtsLanguage} = require('./NativeTTSSpeaker');
        result = await checkAndroidTtsLanguage('vi');
        resolve();
      });
    });
    expect(result).toBe(false);
  });

  it('checkAndroidTtsLanguage returns true on iOS without calling native', async () => {
    mockPlatform.OS = 'ios';
    let result: boolean | undefined;
    await new Promise<void>(resolve => {
      jest.isolateModules(async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const {checkAndroidTtsLanguage} = require('./NativeTTSSpeaker');
        result = await checkAndroidTtsLanguage('vi');
        resolve();
      });
    });
    expect(result).toBe(true);
    expect(mockCheckLanguageAvailable).not.toHaveBeenCalled();
  });
});
