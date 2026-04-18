/**
 * RAM Estimation Helper — Developer Metrics
 *
 * PURPOSE:
 * Provides a JS-side RAM usage estimate for the developer metrics overlay.
 * This is an approximation, NOT an exact measurement.
 *
 * METHODOLOGY:
 * - Primary: Uses Hermes performance.memory JS heap metrics where available.
 * - Fallback (iOS/Android without hermes memory): Static model RAM budget
 *   based on architecture docs (~1.1-1.3 GB total) plus a JS runtime estimate.
 * - The JS heap proxy (used when Hermes memory is available) captures only
 *   the JavaScript engine's heap — it does NOT include native allocations
 *   (STT model, translation model, audio buffers). It is a LOWER BOUND.
 *
 * SAFETY:
 * - All reads are synchronous and do not block the main thread significantly.
 * - No native memory APIs are called directly from JS to avoid bridge instability.
 * - If performance.memory is unavailable, we fall back to static estimation
 *   with a clearly-labeled "≈" prefix to indicate approximation.
 *
 * ACCURACY NOTES:
 * - The static estimate (≈1.1GB) is based on the memory budget in architecture.md §5.1
 * - Real RAM varies by device, OS version, and background apps
 * - Do NOT use these values for billing, limits, or security decisions
 */

interface RamMetrics {
  /** Estimated RAM usage in MB (0 if unavailable) */
  estimatedMB: number;
  /** Human-readable label with unit */
  label: string;
  /** 'hermes' = JS heap proxy | 'static' = model budget approximation */
  source: 'hermes' | 'static';
}

/**
 * Attempts to read Hermes JS heap metrics as a RAM proxy.
 * Returns null if unavailable (e.g., not using Hermes, or memory API disabled).
 */
function tryGetHermesMemory(): {usedJSHeapSize: number; totalJSHeapSize: number} | null {
  try {
    // performance.memory is Hermes-specific and may not exist in all builds
    const memory = (performance as unknown as Record<string, unknown>).memory;
    if (
      memory &&
      typeof memory === 'object' &&
      'usedJSHeapSize' in memory &&
      'totalJSHeapSize' in memory
    ) {
      const m = memory as {usedJSHeapSize: number; totalJSHeapSize: number};
      return {usedJSHeapSize: m.usedJSHeapSize, totalJSHeapSize: m.totalJSHeapSize};
    }
  } catch {
    // Silently ignore — we will fall back to static estimation
  }
  return null;
}

/**
 * Returns an approximate RAM usage estimate for display in dev mode metrics.
 *
 * The Hermes path provides a JS heap lower bound; the static path provides
 * the on-device model RAM budget as a conservative upper bound estimate.
 */
export function getRamMetrics(): RamMetrics {
  const hermesMemory = tryGetHermesMemory();

  if (hermesMemory) {
    // Convert bytes to MB
    const usedMB = Math.round(hermesMemory.usedJSHeapSize / (1024 * 1024));
    return {
      estimatedMB: usedMB,
      label: `${usedMB}MB`,
      source: 'hermes',
    };
  }

  // Static model RAM budget from architecture.md §5.1
  // SenseVoice (~400MB) + On-Device Translation (~50-100MB) + RN runtime (~100MB) + SQLite (~20MB) ≈ 620MB
  // We use 700MB as a conservative estimate for devices with additional overhead.
  const STATIC_RAM_MB = 700;

  return {
    estimatedMB: STATIC_RAM_MB,
    label: `≈${STATIC_RAM_MB}MB`,
    source: 'static',
  };
}
