/**
 * What a session is, and nothing else. No React, no fetch, no Keycloak — those are `claims.ts`'s
 * problem and the doors'. A consumer reading one file to learn the model should read this one.
 */

/** The person. Every field but `id` is optional because a realm decides which scopes it grants. */
export interface AuthUser {
  /** The IdP's stable subject (`sub`). Never an email: an email can be reassigned. */
  readonly id: string;
  readonly email?: string;
  readonly name?: string;
  readonly username?: string;
}

/**
 * One organization the person belongs to, with the roles they hold *inside it*.
 *
 * `alias` is the addressable name — the one in a hostname and in a Keycloak scope. `id` is the
 * stable uuid, present only when the realm's organization mapper is configured to include it, and
 * is the one to store: an alias can be renamed.
 */
export interface Organization {
  readonly alias: string;
  readonly id?: string;
  readonly roles: readonly string[];
}

/**
 * The whole of what the client knows about who is signed in.
 *
 * **There is no active organization here, and the absence is the design.** Membership is stable and
 * comes from the token; which organization you are *looking at* is a property of the request — the
 * URL — and deriving it per request is what lets two tabs sit in two organizations at once. A field
 * here would be the single shared value they would fight over.
 *
 * `roles` are the realm and client roles: global to the person. Roles held inside an organization
 * live on that `Organization`. They are kept apart on purpose, because merging them is how a role
 * granted in one organization comes to authorise something in another.
 */
export interface Session {
  readonly user: AuthUser;
  readonly roles: readonly string[];
  readonly organizations: readonly Organization[];
  /** Epoch milliseconds. The client uses it to refresh early, never to decide access. */
  readonly expiresAt: number;
}

/** Where to come back to, and which organization to ask for, when sending someone to the IdP. */
export interface SignInOptions {
  /** Defaults to the current URL. */
  readonly returnTo?: string;
  /**
   * Ask Keycloak for one organization's scope rather than every one the person belongs to.
   * Omitted, a multi-tenant product should request `organization:*` — `DEFAULT_SCOPE` in
   * `browser.ts` carries why the star is not optional.
   */
  readonly organization?: string;
}

/**
 * What a product holds, and the only seam between the two deployment patterns.
 *
 * RFC 10017 names three architectures for browser applications and this package implements two:
 * a **Backend For Frontend**, where the token never reaches the browser and a cookie carries the
 * session, and a **browser-based OAuth client** with PKCE, for the SPA that has no server to put a
 * confidential client in. `bffAuth` and `browserAuth` are those two, and they are interchangeable
 * here — which is what lets `useSession`, `Gate` and `auth.fetch` be written once.
 *
 * A product names its pattern on one line, at startup, and nothing downstream knows which it chose.
 */
export interface Auth {
  /** The session now, or `null`. Answers from cache and renews when near expiry. */
  getSession(): Promise<Session | null>;
  /**
   * Call `onChange` when the session does — signed in, signed out, renewed, or changed in another
   * tab. Returns the unsubscribe.
   */
  subscribe(onChange: () => void): () => void;
  signIn(options?: SignInOptions): Promise<void>;
  signOut(options?: { readonly returnTo?: string }): Promise<void>;
  /**
   * A `fetch` that stays authenticated: the bearer token under one pattern, the cookie riding
   * along by itself under the other, and a single retry after a renewal in both.
   */
  readonly fetch: typeof globalThis.fetch;
}

/**
 * Why a credential was refused, as a code a product can route on.
 *
 * A boolean cannot be acted upon: "not signed in" sends the person to the IdP, "signed in but not a
 * member" sends them to a page that says so, and telling them apart is the difference between a
 * redirect loop and an explanation. The shape is borrowed from `agents/gateway`, which reports
 * `validity.expired` / `proof.signature-invalid` / `issuer.unexpected` for the same reason.
 *
 * **These codes are about a credential, or about the request for one, and about nothing else.** A
 * programming or deployment fault is not one: `useSession` called outside its provider, or a
 * session too large for a cookie, both throw a plain `Error` on purpose. Giving those codes would invite a product to `catch` them
 * beside a refusal and route them to a sign-in page, which is the wrong answer to "you wired this
 * up wrong" — and it would put a deployment mistake in the same type as a user's session expiring.
 *
 * *What would reverse it:* a product needing to route on one of those programmatically rather than
 * read it in a stack trace. None has; both are faults you fix once, not conditions you handle.
 */
export type AuthErrorCode =
  /** The claims carry no `sub`. Not a session at all — a configuration or IdP fault, never a user's. */
  | "claims.no-subject"
  /** There is no session. The person has not signed in, or it expired. */
  | "session.absent"
  /** Signed in, but holds no membership of the organization being addressed. */
  | "organization.not-a-member"
  /**
   * The organization asked for is not an alias, so it was not put into a scope.
   *
   * The one code here about the *request for* a credential rather than about a credential, and it
   * earns that because the value reaches `begin` from a query parameter on every product with an
   * organization switcher: a space in it is scope injection, and a product wants to answer "no
   * such organization" rather than let an unreadable 400 arrive at someone who typed a link wrong.
   */
  | "organization.invalid"
  /** The callback's `state` is absent, different, or has no transaction to match against. */
  | "callback.state-mismatch"
  /** The ID token's `nonce` is not the one that was sent — a replay. */
  | "callback.nonce-mismatch"
  /** The token endpoint refused the code or the refresh token, or returned no ID token. */
  | "token.exchange-failed";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
