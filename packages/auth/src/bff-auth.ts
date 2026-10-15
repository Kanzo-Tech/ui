import { BOUNDS, deadline } from "./deadline";
import { DEFAULT_RENEW_WITHIN } from "./renew-within";
import { singleFlight } from "./single-flight";
import { Problem } from "@kanzo-tech/kernel";
import { readSession } from "./session";
import type { Auth, Session, SignInOptions } from "./types";

/**
 * The Backend-For-Frontend pattern: the token never reaches the browser.
 *
 * RFC 10017 calls this one *"strongly recommended for business applications, sensitive
 * applications, and applications that handle personal data"*. The server holds the confidential
 * client and the tokens; the browser holds a cookie it cannot read, and asks the server who it is.
 *
 * So there is no engine on this path — no PKCE, no storage — which is why it lives on the root
 * barrel beside the hooks rather than behind a subpath. What it needs from the server is the routes
 * `kanzoAuth` serves: a session endpoint, a refresh, a sign-in and a sign-out.
 *
 * **It holds no session.** `AuthProvider` reads through it as a query on the host's `QueryClient`
 * (`/docs/design/reads`), and that query's cache is the one copy; what this transport adds is what
 * keeps the copy fresh — Auth.js's `SessionProvider`, piece by piece: a session read within a minute
 * of its expiry is renewed, a renewal is announced to the provider, and every tab hears, on a
 * `BroadcastChannel`, when another one loaded, renewed or signed out.
 */

export interface BffAuthConfig {
  /** Where the BFF's auth routes are mounted. Default `/api/auth`. */
  readonly basePath?: string;
  /**
   * The transport every request goes through: the session read, the renewal, and each call made
   * with `Auth.fetch`. Defaults to the global.
   *
   * `bffAuth` bounds the two requests it makes for itself — `/session` and `/refresh`, 30 s each,
   * as `session/silent` — and nothing else. A request a host makes through `Auth.fetch` is the
   * host's to bound, with a signal on that request: a deadline wrapped around this transport would
   * race `bffAuth`'s own on the session read, and one of the two codes would be the wrong one.
   */
  readonly fetch?: typeof globalThis.fetch;
  /** Defaults to assigning `window.location`. */
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

/** What one tab posts to the others: only that the session changed, never the session itself. */
const CHANGED = "changed";

export function bffAuth(config: BffAuthConfig = {}): Auth {
  const base = (config.basePath ?? "/api/auth").replace(/\/$/, "");
  const doFetch = config.fetch ?? ((...args) => globalThis.fetch(...args));
  const go = config.navigate ?? ((url: string) => void (globalThis.location.href = url));
  const name = `@kanzo-tech/auth ${base}`;

  const listeners = new Set<() => void>();
  const announce = () => {
    for (const listener of listeners) listener();
  };

  /**
   * The channel every tab of this origin hears, open while this tab has a listener: a channel does
   * not hear its own posts, so this tab's announcements reach the others and not itself.
   */
  let channel: BroadcastChannel | undefined;
  const tell = () => {
    if (typeof BroadcastChannel === "undefined") return;
    if (channel !== undefined) return channel.postMessage(CHANGED);
    const once = new BroadcastChannel(name);
    once.postMessage(CHANGED);
    once.close();
  };

  /** Whether this tab has read the session yet: its first read is a page that loaded, and says so. */
  let looked = false;
  /** Set by the one sign-in a refused renewal starts; the page is leaving, so it is never unset. */
  let leaving = false;

  const unavailable = (url: string, status: number | undefined, cause?: unknown) =>
    new Problem(
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

  /** A 200's body as a session, or `session/unavailable`: the routes answer "nobody" with a 401. */
  const sessionFrom = async (url: string, response: Response): Promise<Session> => {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw unavailable(url, response.status, error);
    }
    const session = readSession(body);
    if (session === null) throw unavailable(url, response.status);
    return session;
  };

  // Single-flight for the same reason the token path needs it: a page that mounts six components
  // asks six times in one tick, and one answer serves them all. Here it costs a request rather
  // than a revoked token chain, which is a smaller bill for the same mistake.
  //
  // A 401 is the documented answer for "nobody is signed in". Anything else that is not a session
  // — a 5xx, a proxy's page, no answer at all — is a failure, and reading it as "signed out" would
  // send the person to sign in over an outage that will still be there when they get back.
  const read = singleFlight(() =>
    deadline("session/silent", BOUNDS.browser, async (signal): Promise<Session | null> => {
      const response = await send(`${base}/session`, { headers: { Accept: "application/json" }, signal });
      if (response.status === 401) return null;
      if (!response.ok) throw unavailable(`${base}/session`, response.status);
      return sessionFrom(`${base}/session`, response);
    }),
  );

  /**
   * Ask the BFF to spend the refresh token, once for however many asked at the moment, and answer
   * the renewed session — or `null` when the renewal was refused and the session is over.
   *
   * The proxy renews before every page and the forwarder before every request it forwards, so this
   * is for a tab that stays on one page: a session read near its expiry, or a 401 that reached the
   * browser anyway, from a resource the BFF does not front or a token that died between the
   * forwarder's check and the upstream's. Every renewal is announced to the other tabs.
   *
   * `POST`, because the route only answers `POST` — it spends something, and a `GET` that spends
   * something is one prefetch away from spending it unasked.
   */
  const renew = singleFlight(() =>
    deadline("session/silent", BOUNDS.browser, async (signal): Promise<Session | null> => {
      const response = await send(`${base}/refresh`, {
        method: "POST",
        headers: { Accept: "application/json" },
        signal,
      });
      // A refusal (401, 400) is the end of the session; a 5xx is an outage, not a refusal.
      if (response.status >= 500) throw unavailable(`${base}/refresh`, response.status);
      if (!response.ok) return null;
      const session = await sessionFrom(`${base}/refresh`, response);
      tell();
      return session;
    }),
  );

  /** Within the window a server renews in, by the expiry the session names; `0` names none. */
  const expiring = (session: Session) =>
    session.expiresAt > 0 && session.expiresAt - Date.now() < DEFAULT_RENEW_WITHIN * 1000;

  const signIn = async (options: SignInOptions = {}) => {
    const params = new URLSearchParams();
    params.set("returnTo", options.returnTo ?? globalThis.location?.href ?? "/");
    if (options.organization !== undefined) params.set("organization", options.organization);
    go(`${base}/signin?${params.toString()}`);
  };

  return {
    async getSession() {
      const session = await read();
      const first = !looked;
      looked = true;
      // A page that loaded is how a sign-in and a sign-out come back: the other tabs read again.
      if (first) tell();
      return session !== null && expiring(session) ? renew() : session;
    },

    subscribe(onChange) {
      listeners.add(onChange);
      if (channel === undefined && typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(name);
        channel.onmessage = announce;
      }
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) {
          channel?.close();
          channel = undefined;
        }
      };
    },

    signIn,

    async signOut(options = {}) {
      const params = new URLSearchParams();
      if (options.returnTo !== undefined) params.set("returnTo", options.returnTo);
      const query = params.toString();
      // Said before leaving: the page the sign-out lands on may be the IdP's, which reads nothing.
      tell();
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
     * A request whose body cannot be replayed is not retried at all. The request is not bounded
     * here: whoever makes it passes a signal with it.
     */
    fetch: async (input, init) => {
      const response = await doFetch(input, init);
      if (response.status !== 401 || !looked) return response;

      if ((await renew()) !== null) {
        // The provider reads the renewed session; the other tabs were told by the renewal.
        announce();
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
