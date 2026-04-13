const VERBOSE_DEBUG_LOGS = false;

export function debugLog(...args: unknown[]): void {
  if (__DEV__ && VERBOSE_DEBUG_LOGS) {
    console.log(...args);
  }
}

export function infoLog(...args: unknown[]): void {
  if (__DEV__) {
    console.log(...args);
  }
}

export function warnLog(...args: unknown[]): void {
  console.warn(...args);
}

export function errorLog(...args: unknown[]): void {
  console.error(...args);
}
