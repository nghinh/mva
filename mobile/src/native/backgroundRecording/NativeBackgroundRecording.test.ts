// export rỗng: file không có import nào ở top-level nên TypeScript coi là script
// và đẩy các khai báo ra global scope, làm mockPlatform trùng tên với test kia.
export {};

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
  PermissionsAndroid: {
    request: jest.fn().mockResolvedValue('granted'),
    PERMISSIONS: {POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS'},
  },
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

  // startBackgroundRecording là async: trên Android API 33+ nó await xin quyền
  // POST_NOTIFICATIONS trước khi gọi startService, nên phải chờ promise rồi mới
  // assert — isolateModules chạy đồng bộ nên promise được lấy ra ngoài.
  it('startBackgroundRecording calls native startService on Android', async () => {
    let pending: Promise<void> | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      pending = startBackgroundRecording('MVA', 1700000000000);
    });
    await pending;
    expect(mockStartService).toHaveBeenCalledWith('MVA', 1700000000000);
  });

  it('startBackgroundRecording is a no-op on iOS', async () => {
    mockPlatform.OS = 'ios';
    let pending: Promise<void> | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {startBackgroundRecording} = require('./NativeBackgroundRecording');
      pending = startBackgroundRecording('MVA', 1700000000000);
    });
    await pending;
    expect(mockStartService).not.toHaveBeenCalled();
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
