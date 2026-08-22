/**
 * Language pack setup orchestration.
 *
 * Extracted from SplashScreen so it can be tested, and so the bootstrap path
 * can no longer trap the user.
 *
 * =============================================================================
 * WHY THIS IS BOUNDED THE WAY IT IS
 * =============================================================================
 *
 * On iOS the pack download is the Apple system sheet. We cannot observe its
 * outcome: `prepareTranslation()` does not throw when the user taps "Done"
 * without downloading, and `LanguageAvailability.status()` is documented in
 * AppleTranslatorModule as inconsistently reporting `.supported` for packs that
 * are actually installed.
 *
 * The previous implementation looped `while (!packInstalled)` with no attempt
 * cap and no deadline, exiting only when status read back exactly 'installed'.
 * Any of the above ambiguities therefore hung the splash screen forever, and
 * the 'downloading' UI had no cancel affordance, so the app had to be killed.
 *
 * Rules this module follows instead:
 *   1. Every pack gets a bounded number of attempts.
 *   2. The whole run gets an overall deadline.
 *   3. The caller can cancel between attempts.
 *   4. "Installed" means status says so OR a real availability probe succeeds —
 *      the same looser criterion the verification step already used, so a pack
 *      that works is never reported as failed.
 *   5. Nothing here throws. A dead bridge yields 'failed', never a hang.
 *
 * Language packs are a nice-to-have: without them transcription still works and
 * only the translation lane degrades. Nothing in this module may block startup.
 */

export interface PackDescriptor {
  srcLang: string;
  displayName: string;
}

/** The slice of the translator the setup flow needs. Keeps this module testable. */
export interface PackTranslatorPort {
  getStatus(srcLang: string, tgtLang: string): Promise<string>;
  download(srcLang: string, tgtLang: string): Promise<boolean>;
  isAvailable(srcLang: string, tgtLang: string): Promise<boolean>;
}

export type PackOutcome = 'installed' | 'failed' | 'skipped';

export interface PackSetupOptions {
  packs: PackDescriptor[];
  targetLang: string;
  translator: PackTranslatorPort;
  /** Presentations of the system sheet per pack before giving up. */
  maxAttemptsPerPack?: number;
  /** Ceiling for the whole run, across every pack. */
  deadlineMs?: number;
  /** Pause between attempts on the same pack. */
  retryDelayMs?: number;
  now?: () => number;
  delay?: (ms: number) => Promise<void>;
  /** Polled between attempts — set `cancelled` to stop the run. */
  signal?: {cancelled: boolean};
  onPackAttempt?: (srcLang: string, attempt: number) => void;
  onPackResolved?: (srcLang: string, outcome: PackOutcome) => void;
}

export interface PackSetupResult {
  installed: string[];
  failed: string[];
  /** Pairs that make no sense to install, e.g. source === target. */
  skipped: string[];
  cancelled: boolean;
  timedOut: boolean;
}

const DEFAULT_MAX_ATTEMPTS = 2;
const DEFAULT_DEADLINE_MS = 240_000;
const DEFAULT_RETRY_DELAY_MS = 700;

const realDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Ground truth for "can we translate this pair right now".
 *
 * Status alone is not trusted: `.supported` is returned both for a pack that
 * needs downloading and, sometimes, for one already present. `isAvailable`
 * accepts `.installed || .supported`, so it is checked as a fallback rather
 * than as the primary signal.
 */
async function isPackUsable(
  translator: PackTranslatorPort,
  srcLang: string,
  tgtLang: string,
): Promise<boolean> {
  let status = 'unknown';
  try {
    status = await translator.getStatus(srcLang, tgtLang);
  } catch {
    status = 'unknown';
  }

  if (status === 'installed') {
    return true;
  }
  if (status === 'unsupported') {
    return false;
  }

  try {
    return await translator.isAvailable(srcLang, tgtLang);
  } catch {
    return false;
  }
}

export async function runLanguagePackSetup(options: PackSetupOptions): Promise<PackSetupResult> {
  const {
    packs,
    targetLang,
    translator,
    maxAttemptsPerPack = DEFAULT_MAX_ATTEMPTS,
    deadlineMs = DEFAULT_DEADLINE_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    now = Date.now,
    delay = realDelay,
    signal,
    onPackAttempt,
    onPackResolved,
  } = options;

  const result: PackSetupResult = {
    installed: [],
    failed: [],
    skipped: [],
    cancelled: false,
    timedOut: false,
  };

  const startedAt = now();
  const isExpired = () => now() - startedAt >= deadlineMs;
  const isCancelled = () => signal?.cancelled === true;

  const resolvePack = (pack: PackDescriptor, outcome: PackOutcome) => {
    if (outcome === 'installed') {
      result.installed.push(pack.displayName);
    } else if (outcome === 'skipped') {
      result.skipped.push(pack.displayName);
    } else {
      result.failed.push(pack.displayName);
    }
    onPackResolved?.(pack.srcLang, outcome);
  };

  for (let index = 0; index < packs.length; index++) {
    const pack = packs[index];

    // A pair whose source is the target translates to itself. Attempting it
    // used to poison the availability check and silently suppress every other
    // pack when the user picked English as the target language.
    if (pack.srcLang === targetLang) {
      resolvePack(pack, 'skipped');
      continue;
    }

    if (isCancelled()) {
      result.cancelled = true;
      break;
    }

    if (isExpired()) {
      result.timedOut = true;
      for (let rest = index; rest < packs.length; rest++) {
        resolvePack(packs[rest], 'failed');
      }
      break;
    }

    // Already usable — never present the sheet for a pack we can already use.
    if (await isPackUsable(translator, pack.srcLang, targetLang)) {
      resolvePack(pack, 'installed');
      continue;
    }

    let status = 'unknown';
    try {
      status = await translator.getStatus(pack.srcLang, targetLang);
    } catch {
      status = 'unknown';
    }

    // Nothing to download and nothing to retry — the device cannot do this pair.
    if (status === 'unsupported') {
      resolvePack(pack, 'failed');
      continue;
    }

    let installed = false;
    let aborted = false;

    for (let attempt = 1; attempt <= maxAttemptsPerPack; attempt++) {
      if (isCancelled()) {
        result.cancelled = true;
        aborted = true;
        break;
      }
      if (isExpired()) {
        result.timedOut = true;
        aborted = true;
        break;
      }

      onPackAttempt?.(pack.srcLang, attempt);

      try {
        await translator.download(pack.srcLang, targetLang);
      } catch {
        // The sheet may have been dismissed, or the bridge may be gone. Either
        // way the availability probe below decides, not the thrown error.
      }

      if (await isPackUsable(translator, pack.srcLang, targetLang)) {
        installed = true;
        break;
      }

      if (attempt < maxAttemptsPerPack) {
        await delay(retryDelayMs);
      }
    }

    if (installed) {
      resolvePack(pack, 'installed');
      continue;
    }

    if (aborted) {
      if (result.timedOut) {
        for (let rest = index; rest < packs.length; rest++) {
          resolvePack(packs[rest], 'failed');
        }
      }
      break;
    }

    resolvePack(pack, 'failed');
  }

  return result;
}
