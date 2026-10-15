import { Problem, type ProblemCode } from "@kanzo-tech/kernel";

/**
 * Thirty seconds: the figure fossil's `/docs/design/failure` sets for a request to an API from the
 * browser and for a request to an identity provider. One party bounds each wait, the one that makes
 * the request: where a library makes it —
 * `openid-client` — it is handed this figure; where this package makes it,
 * {@link deadline} does.
 */
export const DEADLINE = 30_000;

/**
 * Run `work` with a signal that aborts after {@link DEADLINE}, and reject with `code` and
 * `{ after }` when it does — whether or not `work` honours the signal.
 */
export function deadline<T>(
  code: Extract<ProblemCode, `${string}/silent`>,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Problem(code, `no answer within ${DEADLINE} ms`, { after: DEADLINE });
      controller.abort(error);
      reject(error);
    }, DEADLINE);
    work(controller.signal)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}
