/**
 * One in-flight call at a time, shared by every caller that asks while it runs.
 *
 * This exists for exactly one failure, and it is not a performance one. RFC 10017 requires refresh
 * tokens for browser applications to **rotate on every use**, so a refresh both mints a new token
 * and invalidates the one it was called with. Ten requests that notice an expiring token at the
 * same moment therefore fire ten refreshes with the same token, and nine of them are replaying a
 * token the first already spent — the authorization server is entitled to treat that as theft and
 * revoke the whole chain. The session does not degrade; it dies, and it dies under load, which is
 * the worst way to find out.
 *
 * So the rule is a rule rather than an optimisation: **the refresh path is single-flight.**
 */
export function singleFlight<T>(work: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | undefined;

  return () => {
    // A call that arrives while one is running joins it instead of starting a second.
    if (inFlight !== undefined) return inFlight;

    // The slot is cleared in a `finally` so a rejection does not wedge every later call onto a
    // failure that has already been reported. The next caller gets a fresh attempt — which is what
    // you want when the failure was a dropped connection, and harmless when it was not, because
    // the caller above is the one deciding whether to retry.
    inFlight = work().finally(() => {
      inFlight = undefined;
    });

    return inFlight;
  };
}
