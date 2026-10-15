/**
 * One span in the Performance timeline, `kanzo:<name>` (callers pass `area:name`), from `start` (a
 * `performance.now()`) to now. A page without the API, or one that throws, loses the span and
 * nothing else: a measurement is never worth a failed call. There is no sink.
 */
export function mark(name: string, start: number, detail?: unknown): void {
  try {
    globalThis.performance?.measure(`kanzo:${name}`, { start, end: globalThis.performance.now(), detail });
  } catch {
    // see above
  }
}
