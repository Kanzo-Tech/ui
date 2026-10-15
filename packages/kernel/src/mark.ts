/**
 * One span in the Performance timeline (User Timing Level 3), named `kanzo:<area>:<name>`: the caller
 * passes `area:name`. `start` is a `performance.now()` reading, the timeline's own clock, so there is
 * no clock helper here; `end` is left out and the API takes now. `detail` must be structured-cloneable.
 * A page without the API, or a detail that cannot be cloned, loses the span and nothing else.
 */
export function mark(name: `${string}:${string}`, start: number, detail?: unknown): void {
  try {
    globalThis.performance?.measure(`kanzo:${name}`, { start, detail });
  } catch {
    // a measurement is never worth a failed call
  }
}
