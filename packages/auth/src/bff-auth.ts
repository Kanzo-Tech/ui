import { isReplayable } from "./auth-fetch";
import { singleFlight } from "./single-flight";
import type { Auth, Organization, Session, SignInOptions } from "./types";

/**
 * The Backend-For-Frontend pattern: the token never reaches the browser.
 *
 * RFC 10017 calls this one *"strongly recommended for business applications, sensitive
 * applications, and applications that handle personal data"*. The server holds the confidential
 * client and the tokens; the browser holds a cookie it cannot read, and asks the server who it is.
 *
 * So there is no engine on this path — no PKCE, no storage, no renewal — which is why it lives on
 * the root barrel beside the hooks rather than behind a subpath. What it needs from the server is
 * three routes, which `@kanzo-tech/auth/next` provides: a session endpoint, a sign-in and a
 * sign-out.
 */

export interface BffAuthConfig {
  /** Where the BFF's auth routes are mounted. Default `/api/auth`. */
  readonly basePath?: string;
  /** Injectable for tests. Defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
  /** Injectable for tests. Defaults to assigning `window.location`. */
  readonly navigate?: (url: string) => void;
}

function readOrganization(value: unknown): Organization | null {
  if (typeof value !== "object" || value === null) return null;
  const org = value as Record<string, unknown>;
  const alias = org["alias"];
  if (typeof alias !== "string" || alias.length === 0) return null;
  return {
    alias,
    id: typeof org["id"] === "string" ? org["id"] : undefined,
    roles: Array.isArray(org["roles"])
      ? org["roles"].filter((r): r is string => typeof r === "string")
      : [],
  };
}

/**
 * The session endpoint's answer, checked rather than cast.
 *
 * It is our own server on the other end, and it is still **data off the wire**: a cast here would
 * make a deploy skew or a proxy's error page arrive as a `Session` whose `user` is undefined, and
 * the failure would surface three components away as a property read on nothing. `null` for
 * anything unrecognisable is the same answer as "not signed in", which is the safe reading.
 */
export function readSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;

  const user = body["user"];
  if (typeof user !== "object" || user === null) return null;
  const id = (user as Record<string, unknown>)["id"];
  if (typeof id !== "string" || id.length === 0) return null;

  const person = user as Record<string, unknown>;
  const str = (key: string) =>
    typeof person[key] === "string" && person[key] !== "" ? (person[key] as string) : undefined;

  return {
    user: { id, email: str("email"), name: str("name"), username: str("username") },
    roles: Array.isArray(body["roles"])
      ? body["roles"].filter((r): r is string => typeof r === "string")
      : [],
    organizations: Array.isArray(body["organizations"])
      ? body["organizations"]
          .map(readOrganization)
          .filter((o): o is Organization => o !== null)
      : [],
    expiresAt: typeof body["expiresAt"] === "number" ? body["expiresAt"] : 0,
  };
}

export function bffAuth(config: BffAuthConfig = {}): Auth {
  const base = (config.basePath ?? "/api/auth").replace(/\/$/, "");
  const doFetch = config.fetch ?? ((...args) => globalThis.fetch(...args));
  const go = config.navigate ?? ((url: string) => void (globalThis.location.href = url));

  const listeners = new Set<() => void>();
  const announce = () => {
    for (const listener of listeners) listener();
  };

  let cached: Session | null = null;
  let known = false;

  // Single-flight for the same reason the token path needs it: a page that mounts six components
  // asks six times in one tick, and one answer serves them all. Here it costs a request rather
  // than a revoked token chain, which is a smaller bill for the same mistake.
  const read = singleFlight(async (): Promise<Session | null> => {
    const response = await doFetch(`${base}/session`, {
      headers: { Accept: "application/json" },
    });
    // 401 is the documented answer for "nobody is signed in", not a failure to report.
    if (response.status === 401) return null;
    if (!response.ok) return null;
    return readSession(await response.json().catch(() => null));
  });

  /**
   * Ask the BFF to spend the refresh token, once for however many requests noticed at the moment.
   *
   * This is the browser end of the renewal, and without it the session cookie's lifetime and the
   * access token's are two different clocks with nothing between them: a cookie good for eight
   * hours in front of a token good for one produces seven hours in which `/session` answers 200,
   * the whole application draws, and every request for data is a 401 that nothing acts on.
   *
   * `POST`, because the route only answers `POST` — it spends something, and a `GET` that spends
   * something is one prefetch away from spending it unasked.
   */
  const renew = singleFlight(async (): Promise<boolean> => {
    const response = await doFetch(`${base}/refresh`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    return response.ok;
  });

  const refresh = async (): Promise<Session | null> => {
    const next = cached;
    cached = await read();
    known = true;
    // Announce only a change, so a poll does not re-render the tree every time.
    if ((next === null) !== (cached === null) || next?.user.id !== cached?.user.id) announce();
    return cached;
  };

  return {
    async getSession() {
      if (known) return cached;
      return refresh();
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },

    async signIn(options: SignInOptions = {}) {
      const params = new URLSearchParams();
      params.set("returnTo", options.returnTo ?? globalThis.location?.href ?? "/");
      if (options.organization !== undefined) params.set("organization", options.organization);
      go(`${base}/signin?${params.toString()}`);
    },

    async signOut(options = {}) {
      const params = new URLSearchParams();
      if (options.returnTo !== undefined) params.set("returnTo", options.returnTo);
      const query = params.toString();
      go(query ? `${base}/signout?${query}` : `${base}/signout`);
    },

    /**
     * No `Authorization` header — the cookie rides along on a same-origin request by itself — and
     * **one** retry, behind one renewal.
     *
     * A 401 here is ambiguous in a way it is not under `browserAuth`: the cookie was sent and was
     * accepted, so what expired is the access token *behind* the cookie, which this half of the
     * pattern cannot see. So the 401 is taken as "renew and try again" first and as "the session
     * is gone" only when the renewal is refused — at which point re-reading tells the tree, which
     * is what it did before and all it did before.
     *
     * The retry is once, for the reason `authFetch` gives: twice turns an ended session into a
     * loop against the authorization server. A request whose body cannot be replayed is not
     * retried at all, and `isReplayable` is the same predicate the bearer-token path uses.
     */
    fetch: async (input, init) => {
      const response = await doFetch(input, init);
      if (response.status !== 401 || !known) return response;

      if (await renew()) {
        if (!isReplayable(input, init)) return response;
        return doFetch(input, init);
      }

      known = false;
      await refresh();
      return response;
    },
  };
}
