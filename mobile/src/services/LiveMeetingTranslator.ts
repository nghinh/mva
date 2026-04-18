import {SourceLanguage, TargetLanguage, UtteranceId} from '../shared/types';
import {translationService} from './TranslationService';

export type LiveTranslationTask = {
  utteranceId: UtteranceId;
  text: string;
  sourceLanguage: SourceLanguage;
  targetLanguage: TargetLanguage;
  revision: number;
  timestampMs: number;
};

export type LiveTranslationResult = {
  utteranceId: UtteranceId;
  text: string;
  revision: number;
  timestampMs: number;
  latencyMs: number;
  sourceText: string;
};

export type LiveTranslationSkippedReason = 'busy-replaced' | 'not-ready' | 'memory-pressure' | 'error';

export type LiveTranslationSkipped = {
  task: LiveTranslationTask;
  reason: LiveTranslationSkippedReason;
  error?: unknown;
};

export type Adapter = {
  ensureReady: () => Promise<boolean>;
  translate: (task: LiveTranslationTask) => Promise<LiveTranslationResult>;
  cancelPending: () => void;
};

/**
 * Adapter that uses the platform-specific TranslationService (Apple Translation on iOS,
 * Opus-MT on Android) for live translation.
 *
 * Apple Translation: ~30-50MB RAM, 50-200ms latency (built into iOS 26+)
 * Opus-MT: ~100MB RAM max, Helsinki-NLP models via ONNX Runtime
 */
class PlatformTranslationAdapter implements Adapter {
  async ensureReady(): Promise<boolean> {
    return translationService.initialize().catch(() => false);
  }

  async translate(task: LiveTranslationTask): Promise<LiveTranslationResult> {
    const result = await translationService.translate(task.text, task.sourceLanguage);

    return {
      utteranceId: task.utteranceId,
      text: result.text,
      revision: task.revision,
      timestampMs: task.timestampMs,
      latencyMs: result.latencyMs,
      sourceText: task.text,
    };
  }

  cancelPending(): void {
    // TranslationService.translate is single-shot; cancellation handled by LiveMeetingTranslator queue
  }
}

export class LiveMeetingTranslator {
  private active = false;
  private queuedTask: LiveTranslationTask | null = null;
  private readonly adapter: Adapter;
  // Tracks the utteranceId of the currently-executing translation.
  // Used to detect stale results when an utterance is cancelled mid-flight.
  private currentUtteranceId: UtteranceId | null = null;

  constructor(adapter: Adapter = new PlatformTranslationAdapter()) {
    this.adapter = adapter;
  }

  cancelPending(): void {
    this.queuedTask = null;
    this.adapter.cancelPending();
    // Note: we don't clear currentUtteranceId here because the in-flight
    // translation will complete; we just prevent its result from dispatching.
  }

  async submit(
    task: LiveTranslationTask,
    handlers: {
      onResult: (result: LiveTranslationResult) => Promise<void> | void;
      onSkipped: (skipped: LiveTranslationSkipped) => Promise<void> | void;
    },
  ): Promise<void> {
    if (this.active) {
      const replaced = this.queuedTask;
      this.queuedTask = task;
      if (replaced) {
        await handlers.onSkipped({task: replaced, reason: 'busy-replaced'});
      }
      return;
    }

    this.active = true;
    let nextTask: LiveTranslationTask | null = task;

    try {
      while (nextTask) {
        const currentTask = nextTask;
        nextTask = null;

        // Mark this utteranceId as in-flight so cancelPending can detect stale results
        this.currentUtteranceId = currentTask.utteranceId;

        const ready = await this.adapter.ensureReady();
        if (!ready) {
          this.currentUtteranceId = null;
          await handlers.onSkipped({
            task: currentTask,
            reason: 'not-ready',
          });
        } else {
          try {
            const result = await this.adapter.translate(currentTask);
            // Check if this result is still for the current utterance
            // (i.e., the utterance was not cancelled while translation was in-flight)
            if (this.currentUtteranceId !== currentTask.utteranceId) {
              // Stale result — utterance was cancelled, skip dispatching
              continue;
            }
            this.currentUtteranceId = null;
            await handlers.onResult(result);
          } catch (error) {
            this.currentUtteranceId = null;
            await handlers.onSkipped({
              task: currentTask,
              reason: 'error',
              error,
            });
          }
        }

        if (this.queuedTask) {
          nextTask = this.queuedTask;
          this.queuedTask = null;
        }
      }
    } finally {
      this.active = false;
      this.currentUtteranceId = null;
    }
  }
}

let liveMeetingTranslatorSingleton: LiveMeetingTranslator | null = null;

/**
 * Returns the singleton LiveMeetingTranslator instance.
 * Uses PlatformTranslationAdapter (Apple Translation on iOS, Opus-MT on Android)
 * for memory-efficient live translation (~30-50MB on iOS, ~100MB on Android).
 */
export function getLiveMeetingTranslator(): LiveMeetingTranslator {
  if (!liveMeetingTranslatorSingleton) {
    liveMeetingTranslatorSingleton = new LiveMeetingTranslator(new PlatformTranslationAdapter());
  }
  return liveMeetingTranslatorSingleton;
}

/** Creates a new LiveMeetingTranslator with the given adapter (for testing or alternative paths). */
export function createLiveMeetingTranslator(adapter: Adapter): LiveMeetingTranslator {
  return new LiveMeetingTranslator(adapter);
}
