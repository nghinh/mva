const mockStartService = jest.fn();
const mockStopService = jest.fn();
const mockPlatform = {OS: 'android' as string, Version: 33};

jest.mock('react-native', () => ({
  NativeModules: {
    BackgroundRecordingModule: {
      startService: mockStartService,
      stopService: mockStopService,
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

describe('NativeBackgroundRecording', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockPlatform.OS = 'android';
  });

  it('BackgroundRecordingEmitter is non-null on Android when module exists', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {BackgroundRecordingEmitter} = require('./NativeBackgroundRecording');
      expect(BackgroundRecordingEmitter).not.toBeNull();
    });
  });

  it('BackgroundRecordingEmitter is null on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {BackgroundRecordingEmitter} = require('./NativeBackgroundRecording');
      expect(BackgroundRecordingEmitter).toBeNull();
    });
  });

  it('startBackgroundRecording calls native startService on Android', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      startBackgroundRecording('MVA', 1700000000000);
      expect(mockStartService).toHaveBeenCalledWith('MVA', 1700000000000);
    });
  });

  it('startBackgroundRecording is a no-op on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      startBackgroundRecording('MVA', 1700000000000);
      expect(mockStartService).not.toHaveBeenCalled();
    });
  });

  it('stopBackgroundRecording calls native stopService on Android', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {stopBackgroundRecording} = require('./NativeBackgroundRecording');
      stopBackgroundRecording();
      expect(mockStopService).toHaveBeenCalled();
    });
  });

  it('stopBackgroundRecording is a no-op on iOS', () => {
    mockPlatform.OS = 'ios';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {stopBackgroundRecording} = require('./NativeBackgroundRecording');
      stopBackgroundRecording();
      expect(mockStopService).not.toHaveBeenCalled();
    });
  });
});
