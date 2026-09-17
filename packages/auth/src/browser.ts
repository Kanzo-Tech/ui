import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
  type UserManagerSettings,
} from "oidc-client-ts";
import { authFetch, type TokenSource } from "./auth-fetch";
import { claims } from "./claims";
import { singleFlight } from "./single-flight";
import type { Auth, Session, SignInOptions } from "./types";

/**
 * `./browser` — RFC 10017's *browser-based OAuth 2.0 client*: a public client with PKCE, for the
 * SPA that has no server to hold a confidential one. `agents/viewer` and `hub/browser` are both
 * that shape, and for them it is the only architecture available.
 *
 * **This file is an adapter, not an implementation.** PKCE, silent renewal, storage, the callback
 * and RP-initiated logout are `oidc-client-ts`'s; a `UserManager` goes in and our `Auth` comes out.
 * The reference evaluation picked that library precisely so none of the protocol would be written
 * here, because a hand-written flow is where a mistake stops being a bug and becomes a
 * vulnerability. What is genuinely ours is the four things no library can have: Keycloak's claim
 * vocabulary read into one `Session`, the organization scope, the single-flight renewal, and one
 * `Session` across both deployment patterns.
 *
 * There is no `"use client"` here, and that is the rule rather than an oversight: nothing in this
 * module is stateful and no browser global is read at module scope. The listeners are registered
 * inside `subscribe`, and `location` inside the factory.
 */

/**
 * `organization:*`, not `organization`.
 *
 * Plain `organization` returns the single organization when there is one and **prompts for a
 * choice** when there are several — which is the documented behaviour behind the reports of the
 * claim "disappearing" for multi-organization users. It never disappeared; the selection was
 * missing. A single-tenant product pays nothing for the star: the claim is simply absent.
 */
const DEFAULT_SCOPE = "openid profile email organization:*";

/** The query parameters an authorization response puts in the URL, and that must not stay there. */
const RESPONSE_PARAMS = ["code", "state", "session_state", "iss", "error", "error_description"];

/** What this adapter reads off the library's `User`. The access token is carried, never opened. */
export interface OidcUser {
  readonly profile: unknown;
  readonly access_token: string;
  readonly expires_at?: number;
  readonly url_state?: string;
}

/**
 * The slice of `UserManager` this file uses.
 *
 * It exists so the manager can be injected, which is what lets everything below be tested with no
 * network, no IdP and no iframe. It is deliberately structural and deliberately small — and the
 * default factory returns a real `UserManager`, so the compiler is what keeps the slice honest.
 */
export interface OidcUserManager {
  getUser(): Promise<OidcUser | null>;
  signinRedirect(args?: { scope?: string; url_state?: string }): Promise<void>;
  signinCallback(url?: string): Promise<OidcUser | undefined>;
  signinSilent(): Promise<OidcUser | null>;
  signoutRedirect(args?: { post_logout_redirect_uri?: string }): Promise<void>;
  readonly events: {
    addUserLoaded(cb: () => void): () => void;
    addUserUnloaded(cb: () => void): () => void;
    addAccessTokenExpired(cb: () => void): () => void;
    addUserSessionChanged(cb: () => void): () => void;
  };
}

export interface BrowserAuthConfig {
  /** The realm's issuer, e.g. `https://id.kanzo.tech/realms/kanzo`. */
  readonly issuer: string;
  /**
   * This application's Keycloak client id. It selects the credential and, through {@link claims},
   * which of the token's roles are this application's.
   */
  readonly clientId: string;
  /** Must be registered with the IdP. Defaults to the current origin. */
  readonly redirectUri?: string;
  /** Must be registered with the IdP. Defaults to the current origin. */
  readonly postLogoutRedirectUri?: string;
  /** Defaults to `openid profile email organization:*`. */
  readonly scope?: string;
  /**
   * Poll the OP's session state, so a sign-out performed elsewhere reaches this tab.
   *
   * Off by default because it cannot be relied on: it runs a hidden cross-site iframe, and a
   * browser that partitions third-party cookies — which is now most of them — makes it report
   * nothing rather than fail loudly. It is a knob and not a default for exactly that reason.
   */
  readonly monitorSession?: boolean;
  /** The seam the tests inject through. Defaults to the real `UserManager`. */
  readonly createManager?: (settings: UserManagerSettings) => OidcUserManager;
}

/** `code` or `error`, together with `state`. Nothing else in a URL is an authorization response. */
function isAuthorizationResponse(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("state") && (params.has("code") || params.has("error"));
}

function scopeFor(scope: string, organization: string | undefined): string {
  if (organization === undefined) return scope;
  // Replace rather than append: `organization:* organization:acme` asks for both, and the point of
  // naming one is to get one.
  const rest = scope.split(" ").filter((s) => s.length > 0 && !s.startsWith("organization:"));
  return [...rest, `organization:${organization}`].join(" ");
}

export function browserAuth(config: BrowserAuthConfig): Auth {
  const origin = globalThis.location?.origin ?? "";
  const scope = config.scope ?? DEFAULT_SCOPE;

  const settings: UserManagerSettings = {
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: config.redirectUri ?? origin,
    post_logout_redirect_uri: config.postLogoutRedirectUri ?? origin,
    scope,
    response_type: "code",
    monitorSession: config.monitorSession ?? false,

    // **Tokens in memory only.** The library's default is `sessionStorage`, and RFC 10017 is
    // explicit that under a public client anything script can read is something an XSS can steal;
    // a token on disk outlives the page that was compromised to get it.
    //
    // The cost is real and is the whole of the trade: a full page load starts with nothing, so the
    // session is re-established by a silent renewal or a redirect rather than read off disk. That
    // is one round trip on every load, and a signed-out first paint for any application that draws
    // before `getSession()` settles.
    userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),

    // The PKCE verifier, `state` and `nonce` are **not** tokens and cannot be in memory: the page
    // is unloaded by the navigation to the IdP, and memory goes with it. `sessionStorage` rather
    // than the library's `localStorage` default — per tab, gone when the tab closes, and never
    // visible to a second tab racing the same sign-in.
    stateStore: new WebStorageStateStore({ store: globalThis.sessionStorage }),
  };

  const manager = (config.createManager ?? ((s) => new UserManager(s)))(settings);

  /** Take the spent response out of the URL, and honour `returnTo` if it is ours to honour. */
  const restore = (returnTo: string | undefined): void => {
    const here = new URL(globalThis.location.href);
    for (const key of RESPONSE_PARAMS) here.searchParams.delete(key);
    const wanted = returnTo === undefined ? here : new URL(returnTo, here.origin);
    // `url_state` round-trips through the IdP, so following it anywhere would make our own callback
    // the bounce in an open redirect. Same origin, or we stay where we are.
    const url = wanted.origin === here.origin ? wanted : here;
    globalThis.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  /**
   * Finish a redirect the IdP has just sent back.
   *
   * The URL is cleaned either way. An authorization code is single-use, and one left in the address
   * bar reaches history, bookmarks and the `Referer` — and replays as an error on the next reload.
   */
  const complete = async (): Promise<OidcUser | null> => {
    if (!isAuthorizationResponse(globalThis.location.search)) return null;
    try {
      const user = (await manager.signinCallback(globalThis.location.href)) ?? null;
      restore(user?.url_state);
      return user;
    } catch {
      // A stale state entry or a reloaded callback URL is "not signed in", not an exception for
      // every caller of `getSession` to handle.
      restore(undefined);
      return null;
    }
  };

  let completing: Promise<OidcUser | null> | undefined;

  const load = singleFlight(async (): Promise<OidcUser | null> => {
    completing ??= complete();
    return (await completing) ?? manager.getUser();
  });

  /**
   * One renewal at a time, shared by every caller — the most load-bearing line in this file, and
   * the failure `singleFlight` exists for: under the rotation RFC 10017 requires, a second renewal
   * replays a token the first already spent.
   */
  const renew = singleFlight(async (): Promise<OidcUser | null> => {
    try {
      return await manager.signinSilent();
    } catch {
      // A silent renewal fails when the refresh token is gone, rotated out, or the IdP session has
      // ended. All three mean "no session", and the answer is the same one `getUser` gives for it.
      return null;
    }
  });

  const isExpired = (user: OidcUser): boolean =>
    user.expires_at !== undefined && user.expires_at * 1000 <= Date.now();

  /**
   * The user — renewed when the token it carries has expired, and **asked for when there is no
   * user at all**.
   *
   * That second case is the whole of what makes memory-only storage liveable, and it was missing:
   * this returned `null` the moment `load()` did, so every reload signed the person out while the
   * comment on `userStore` promised a silent renewal would pick them back up. Memory-only is a
   * defensible trade against XSS *because* the IdP still holds the session and a `prompt=none`
   * round trip recovers it; without that round trip it is just a session that dies on F5, which no
   * product would accept and which no amount of XSS resistance would buy back.
   *
   * The cost is the one the `userStore` comment already names: an anonymous cold load spends a
   * failed `prompt=none` too. `renew()` answers `null` for it rather than throwing, so the caller
   * sees the same "not signed in" it saw before — one round trip later.
   */
  const fresh = async (): Promise<OidcUser | null> => {
    const user = await load();
    if (user === null) return renew();
    return isExpired(user) ? renew() : user;
  };

  const toSession = (user: OidcUser): Session => {
    const session = claims(user.profile, { clientId: config.clientId });
    if (user.expires_at === undefined) return session;
    // The access token's expiry comes from the token *response*, not from opening the token —
    // which stays opaque. It is the credential we attach, so it is the one worth counting down.
    return { ...session, expiresAt: user.expires_at * 1000 };
  };

  const source: TokenSource = {
    async current() {
      return (await fresh())?.access_token ?? null;
    },
    async renew() {
      return (await renew())?.access_token ?? null;
    },
  };

  return {
    async getSession() {
      const user = await fresh();
      return user === null ? null : toSession(user);
    },

    subscribe(onChange) {
      const detach = [
        manager.events.addUserLoaded(onChange),
        manager.events.addUserUnloaded(onChange),
        manager.events.addAccessTokenExpired(onChange),
        manager.events.addUserSessionChanged(onChange),
      ];
      return () => {
        for (const off of detach) off();
      };
    },

    async signIn(options: SignInOptions = {}) {
      await manager.signinRedirect({
        scope: scopeFor(scope, options.organization),
        url_state: options.returnTo ?? globalThis.location.href,
      });
    },

    async signOut(options = {}) {
      // RP-initiated logout through the library, which discovers `end_session_endpoint` and sends
      // the `id_token_hint`. A hand-built URL gets both wrong and neither failure is visible.
      await manager.signoutRedirect({
        post_logout_redirect_uri: options.returnTo ?? config.postLogoutRedirectUri,
      });
    },

    fetch: authFetch(source),
  };
}
