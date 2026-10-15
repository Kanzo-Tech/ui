import type { Problem } from "./problem.js";

/**
 * The promise, or the signal's reason the moment it aborts, with the work behind it left to finish
 * unread. For an API that takes no signal (a call into wasm); a query is interrupted, not abandoned.
 */
export function until<T>(answer: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return answer;
  if (signal.aborted) {
    answer.catch(() => {}); // abandoned: its late rejection is not the caller's to see
    return Promise.reject(signal.reason);
  }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    answer.then(
      (value) => (signal.removeEventListener("abort", abort), resolve(value)),
      (error) => (signal.removeEventListener("abort", abort), reject(error)),
    );
  });
}

/**
 * Bound a wait on something outside the process, once. `wait` is given a signal that aborts when
 * the deadline passes or the caller's does. The deadline rejects with `silent(ms)`, a Problem naming
 * who did not answer; the caller's abort rejects with the caller's reason. The clock is
 * `setTimeout`, so fake timers drive it.
 */
export async function within<T>(
  ms: number,
  wait: (signal: AbortSignal) => Promise<T>,
  { signal, silent }: { readonly signal?: AbortSignal; readonly silent: (after: number) => Problem },
): Promise<T> {
  signal?.throwIfAborted();
  const deadline = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const problem = silent(ms);
      deadline.abort(problem);
      reject(problem);
    }, ms);
  });
  try {
    const composed = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
    return await until(Promise.race([wait(composed), late]), signal);
  } finally {
    clearTimeout(timer);
  }
}
