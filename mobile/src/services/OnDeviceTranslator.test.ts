import {OnDeviceTranslator, TranslationCancelledError} from './OnDeviceTranslator';

// Create a mock translation service
const mockTranslate = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(true);
const mockUnload = jest.fn().mockResolvedValue(undefined);
const mockIsAvailable = jest.fn().mockResolvedValue(true);

// Factory được jest.mock hoist lên đầu file và chạy ngay khi OnDeviceTranslator
// require('./TranslationService') — lúc đó các const mock* ở trên còn chưa gán.
// Vì vậy phải tham chiếu chúng lazy bên trong hàm, không gán trực tiếp.
jest.mock('./TranslationService', () => ({
  translationService: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    translate: (...args: unknown[]) => mockTranslate(...args),
    unload: (...args: unknown[]) => mockUnload(...args),
    isAvailable: (...args: unknown[]) => mockIsAvailable(...args),
  },
}));

describe('OnDeviceTranslator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const flushMicrotasks = async () => {
    await Promise.resolve();
  };

  it('rejects queued requests when pending work is cancelled', async () => {
    const translator = new OnDeviceTranslator();
    let releaseActive: ((value: {text: string; latencyMs: number}) => void) | undefined;

    mockTranslate.mockImplementationOnce(
      () => new Promise<{text: string; latencyMs: number}>((resolve) => {
        releaseActive = resolve;
      }),
    ).mockResolvedValueOnce({text: 'queued result', latencyMs: 10});

    const activePromise = translator.translate({text: 'active', sourceLanguage: 'en'});
    await flushMicrotasks();
    const queuedPromise = translator.translate({text: 'queued', sourceLanguage: 'en'});
    const queuedResult = queuedPromise.catch((error: unknown) => error);

    translator.cancelPending();
    releaseActive?.({text: 'active result', latencyMs: 10});

    await expect(activePromise).resolves.toEqual({text: 'active result', version: 1});
    await expect(queuedResult).resolves.toBeInstanceOf(TranslationCancelledError);
  });

  it('cancels queued work before unloading the translator', async () => {
    const translator = new OnDeviceTranslator();
    (translator as unknown as {active: boolean}).active = true;
    const queuedPromise = translator.translate({text: 'queued', sourceLanguage: 'en'});
    const queuedResult = queuedPromise.catch((error: unknown) => error);

    translator.unload();

    await expect(queuedResult).resolves.toBeInstanceOf(TranslationCancelledError);
    expect(mockUnload).toHaveBeenCalledTimes(1);
    expect(mockTranslate).not.toHaveBeenCalled();
  });
});