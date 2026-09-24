/**
 * A `fetch` that stays authenticated.
 *
 * This is the seam a product already has. keasy's API client is
 * `createClient({ baseUrl: "/" })` with one middleware; the viewer's trace source takes its
 * transport as a parameter. Handing either an authenticated `fetch` changes one line and no call
 * site — which is the point, because the alternative is every call site remembering a header.
 *
 * Auth0's SPA SDK ships the same shape for the same reason: `fetchWithAuth`, *"a drop-in replacement
 * for the Fetch API's `fetch()` method"* that builds the headers and handles the retries.
 */

/**
 * Where a token comes from, and how to ask for a fresh one.
 *
 * Both are the implementation's business to make cheap and **single-flight** — see `singleFlight`.
 * `current` is called on every request, so it must answer from cache until the token is near
 * expiry. `null` from both is legitimate: it means there is no bearer token to attach.
 */
export interface TokenSource {
  current(): Promise<string | null>;
  renew(): Promise<string | null>;
}

/**
 * Can this request be sent a second time?
 *
 * A body that is a stream can be read once, so a retry would send an empty one — silently, with a
 * misleading error at the far end. Where we cannot prove the body is replayable we do not retry: the
 * 401 reaches the caller, which is honest, rather than a corrupted request reaching the server.
 *
 * Exported for `bff-auth.ts`, which retries for a different reason — a renewed cookie rather than
 * a renewed bearer token — and must not answer the question differently. It is not on the barrel:
 * it is a shared predicate between two implementations, not a thing a consumer holds.
 */
export function isReplayable(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (typeof Request !== "undefined" && input instanceof Request && input.body !== null) return false;
  const body = init?.body;
  if (body === undefined || body === null) return true;
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
}

/**
 * Wrap a `fetch` so every request carries the session, and one stale token does not surface as a
 * failure the user has to see.
 *
 * The retry is **once**, and only on a 401 we sent a token for. Retrying a 403 would be wrong — that
 * is an answer, not a stale credential — and retrying twice turns an expired session into a loop
 * against the authorization server.
 */
export function authFetch(
  source: TokenSource,
  base: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch {
  return async (input, init) => {
    const send = async (token: string | null): Promise<Response> => {
      const inherited =
        init?.headers ??
        (typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
      const headers = new Headers(inherited);
      if (token !== null) headers.set("Authorization", `Bearer ${token}`);
      return base(input, { ...init, headers });
    };

    const token = await source.current();
    const response = await send(token);

    // Nothing to renew against, or nothing that says the credential was the problem.
    if (response.status !== 401 || token === null) return response;
    if (!isReplayable(input, init)) return response;

    const renewed = await source.renew();
    if (renewed === null || renewed === token) return response;

    return send(renewed);
  };
}
