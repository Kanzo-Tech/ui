import { AuthError, type AuthErrorCode } from "./types";

/**
 * Every wait this package makes, in milliseconds, and the table `/docs/design/failure` draws it
 * from. One party bounds each wait, the one that makes the request: where a library makes it
 * (`openid-client`, `jose`) it is handed the figure; where this package makes it, {@link deadline}
 * does.
 *
 * **Deadlines nest: an inner wait expires before the one around it**, and an outer one is at least
 * the sum of the inner waits that run one after another inside it. `deadline.test.ts` reads this
 * table and asserts both, so the next equal pair is found by a test and not by an outage.
 */
export const BOUNDS = {
  /** The browser's `/session` and `/refresh`: the outermost wait here, inside the person's patience. */
  browser: 30_000,
  /** The forwarder, until the upstream's headers: inside the browser's, and not an identity request. */
  forwarder: 25_000,
  /** One request from the BFF to the identity provider: discovery, keys, a grant. */
  idp: 10_000,
  /** One `ticketStore` command. */
  store: 5_000,
} as const;

/**
 * Run `work` with a signal that aborts after `ms`, and reject with `code` and `{ after }` when it
 * does — whether or not `work` honours the signal.
 */
export function deadline<T>(
  code: AuthErrorCode,
  ms: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new AuthError(code, `no answer within ${ms} ms`, { after: ms });
      controller.abort(error);
      reject(error);
    }, ms);
    work(controller.signal)
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}
