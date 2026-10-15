import type { Problem } from "./problem.js";

/**
 * The promise, or the signal's reason the moment it aborts, with the work behind it left to finish
 * unread. For an API that takes no signal (a call into wasm); a query is interrupted, not abandoned.
 * It is fossil's `until`, with the signal optional.
 */
export function until<T>(answer: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return answer;
  return new Promise<T>((resolve, reject) => {
    const stop = (): void => reject(signal.reason);
    // `then(resolve, reject)` also handles an abandoned answer's late rejection: it is never unhandled.
    answer.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
    if (signal.aborted) stop();
    else signal.addEventListener("abort", stop, { once: true });
  });
}

/**
 * Bound a wait on something outside the process, once. `wait` is given a signal that aborts when
 * the deadline passes or the caller's does (`AbortSignal.any`: its reason is the first abort's). The
 * deadline aborts with `silent(ms)`, a Problem naming who did not answer; the caller's abort rejects
 * with the caller's reason. The clock is `setTimeout`, not `AbortSignal.timeout`, so fake timers
 * drive it and the reason is a Problem and not a `TimeoutError`.
 */
export async function within<T>(
  ms: number,
  wait: (signal: AbortSignal) => Promise<T>,
  { signal, silent }: { readonly signal?: AbortSignal | undefined; readonly silent: (after: number) => Problem },
): Promise<T> {
  signal?.throwIfAborted();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(silent(ms)), ms);
  const either = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
  try {
    return await until(wait(either), either);
  } finally {
    clearTimeout(timer);
  }
}
