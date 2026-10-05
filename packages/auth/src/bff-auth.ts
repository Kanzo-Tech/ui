import { deadline } from "./deadline";
import { singleFlight } from "./single-flight";
import { AuthError, type Auth, type Organization, type Session, type SignInOptions } from "./types";

/**
 * The Backend-For-Frontend pattern: the token never reaches the browser.
 *
 * RFC 10017 calls this one *"strongly recommended for business applications, sensitive
 * applications, and applications that handle personal data"*. The server holds the confidential
 * client and the tokens; the browser holds a cookie it cannot read, and asks the server who it is.
 *
 * So there is no engine on this path — no PKCE, no storage, no renewal — which is why it lives on
 * the root barrel beside the hooks rather than behind a subpath. What it needs from the server is
 * the routes `kanzoAuth` serves: a session endpoint, a refresh, a sign-in and a sign-out.
 */

export interface BffAuthConfig {
  /** Where the BFF's auth routes are mounted. Default `/api/auth`. */
  readonly basePath?: string;
  /** Injectable for tests. Defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
  /** Injectable for tests. Defaults to assigning `window.location`. */
  readonly navigate?: (url: string) => void;
}

/**
 * Can this request be sent a second time?
 *
 * A body that is a stream can be read once, so a retry would send an empty one — silently, with a
 * misleading error at the far end. Where we cannot prove the body is replayable we do not retry: the
 * 401 reaches the caller, which is honest, rather than a corrupted request reaching the server.
 */
function isReplayable(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (typeof Request !== "undefined" && input instanceof Request && input.body !== null) return false;
  const body = init?.body;
  if (body === undefined || body === null) return true;
  return !(typeof ReadableStream !== "undefined" && body instanceof ReadableStream);
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
 * anything unrecognisable; `bffAuth` reads a 200 it cannot read as `session/unavailable`, because
 * the endpoint answers "nobody is signed in" with a 401 and never with a body.
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
    organization:
      typeof body["organization"] === "string" && body["organization"] !== ""
        ? body["organization"]
        : undefined,
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
  /** Set by the one sign-in a refused renewal starts; the page is leaving, so it is never unset. */
  let leaving = false;

  const unavailable = (url: string, status: number | undefined, cause?: unknown) =>
    new AuthError(
      "session/unavailable",
      status === undefined ? `${url} could not be reached` : `${url} answered ${status}`,
      status === undefined ? {} : { status },
      cause === undefined ? undefined : { cause },
    );

  const send = async (url: string, init: RequestInit): Promise<Response> => {
    try {
      return await doFetch(url, init);
    } catch (error) {
      if (init.signal?.aborted) throw init.signal.reason;
      throw unavailable(url, undefined, error);
    }
  };

  // Single-flight for the same reason the token path needs it: a page that mounts six components
  // asks six times in one tick, and one answer serves them all. Here it costs a request rather
  // than a revoked token chain, which is a smaller bill for the same mistake.
  //
  // A 401 is the documented answer for "nobody is signed in". Anything else that is not a session
  // — a 5xx, a proxy's page, no answer at all — is a failure, and reading it as "signed out" would
  // send the person to sign in over an outage that will still be there when they get back.
  const read = singleFlight(() =>
    deadline("session/silent", async (signal): Promise<Session | null> => {
      const response = await send(`${base}/session`, { headers: { Accept: "application/json" }, signal });
      if (response.status === 401) return null;
      if (!response.ok) throw unavailable(`${base}/session`, response.status);
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw unavailable(`${base}/session`, response.status, error);
      }
      const session = readSession(body);
      if (session === null) throw unavailable(`${base}/session`, response.status);
      return session;
    }),
  );

  /**
   * Ask the BFF to spend the refresh token, once for however many requests noticed at the moment.
   *
   * The proxy renews before every page and the forwarder before every request it forwards, so this
   * is the last of three: a 401 that reached the browser anyway, from a resource the BFF does not
   * front or a token that died between the forwarder's check and the upstream's.
   *
   * `POST`, because the route only answers `POST` — it spends something, and a `GET` that spends
   * something is one prefetch away from spending it unasked.
   */
  const renew = singleFlight(() =>
    deadline("session/silent", async (signal): Promise<boolean> => {
      const response = await send(`${base}/refresh`, {
        method: "POST",
        headers: { Accept: "application/json" },
        signal,
      });
      // A refusal (401, 400) is the end of the session; a 5xx is an outage, not a refusal.
      if (response.status >= 500) throw unavailable(`${base}/refresh`, response.status);
      return response.ok;
    }),
  );

  const refresh = async (): Promise<Session | null> => {
    const next = cached;
    cached = await read();
    known = true;
    // Announce only a change, so a poll does not re-render the tree every time.
    if ((next === null) !== (cached === null) || next?.user.id !== cached?.user.id) announce();
    return cached;
  };

  const signIn = async (options: SignInOptions = {}) => {
    const params = new URLSearchParams();
    params.set("returnTo", options.returnTo ?? globalThis.location?.href ?? "/");
    if (options.organization !== undefined) params.set("organization", options.organization);
    go(`${base}/signin?${params.toString()}`);
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

    signIn,

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
     * A 401 here is ambiguous: the cookie was sent and was accepted, so what expired may be the
     * access token *behind* the cookie, which this half of the pattern cannot see. So the 401 is
     * taken as "renew and try again" first, and as "the session is over" only when the renewal is
     * refused — and then the answer is to sign in, once, coming back to this page. One layer: a
     * product's data client does not need a 401 branch of its own.
     *
     * The retry is once: twice turns an ended session into a loop against the authorization server.
     * A request whose body cannot be replayed is not retried at all.
     */
    fetch: async (input, init) => {
      const response = await doFetch(input, init);
      if (response.status !== 401 || !known) return response;

      if (await renew()) {
        if (!isReplayable(input, init)) return response;
        return doFetch(input, init);
      }

      if (!leaving) {
        leaving = true;
        await signIn({ returnTo: globalThis.location?.href });
      }
      return response;
    },
  };
}
