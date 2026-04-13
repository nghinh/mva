import {getNativeNllbTranslator} from '../native/NativeNllbTranslator';
import {OnDeviceTranslator, TranslationCancelledError} from './OnDeviceTranslator';

const mockNativeTranslator = {
  initialize: jest.fn(),
  isLoaded: jest.fn(() => Promise.resolve(true)),
  unload: jest.fn(() => Promise.resolve()),
  translate: jest.fn(),
};

jest.mock('../native/NativeNllbTranslator', () => ({
  getNativeNllbTranslator: () => mockNativeTranslator,
}));

const nativeTranslator = getNativeNllbTranslator()!;

describe('OnDeviceTranslator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const flushMicrotasks = async () => {
    await Promise.resolve();
  };

  it('rejects queued requests when pending work is cancelled', async () => {
    const translator = new OnDeviceTranslator();
    let releaseActive: ((value: string) => void) | undefined;

    jest.mocked(nativeTranslator.translate)
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          releaseActive = resolve;
        }),
      )
      .mockResolvedValueOnce('queued result');

    const activePromise = translator.translate({text: 'active', sourceLanguage: 'eng_Latn'});
    await flushMicrotasks();
    const queuedPromise = translator.translate({text: 'queued', sourceLanguage: 'eng_Latn'});
    const queuedResult = queuedPromise.catch((error: unknown) => error);

    translator.cancelPending();
    releaseActive?.('active result');

    await expect(activePromise).resolves.toEqual({text: 'active result', version: 1});
    await expect(queuedResult).resolves.toBeInstanceOf(TranslationCancelledError);
  });

  it('cancels queued work before unloading the native translator', async () => {
    const translator = new OnDeviceTranslator();
    (translator as unknown as {active: boolean}).active = true;
    const queuedPromise = translator.translate({text: 'queued', sourceLanguage: 'eng_Latn'});
    const queuedResult = queuedPromise.catch((error: unknown) => error);

    translator.unload();

    await expect(queuedResult).resolves.toBeInstanceOf(TranslationCancelledError);
    expect(nativeTranslator.unload).toHaveBeenCalledTimes(1);
    expect(nativeTranslator.translate).not.toHaveBeenCalled();
  });
});
