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
 * One organization the person belongs to, with the roles they hold *inside it* and the groups they
 * are in there.
 *
 * `alias` is the addressable name — the one in a hostname and in a Keycloak scope. `id` is the
 * stable uuid, present only when the realm's organization mapper is configured to include it, and
 * is the one to store: an alias can be renamed.
 *
 * `groups` are the **ids** of the organization's groups the person is in — and, as the realm
 * configures it, the groups above those — which is what an application keys a grant to a group by
 * ("Research may use this"). Never a name: a group's name is the organization's to change, and a
 * grant keyed by it would move with the rename. An id means something only inside this
 * organization, as a role does. Empty for a realm whose application does not ask for them.
 *
 * `groupsOverage` is Microsoft Entra ID's overage rule: the person is in more groups there than the
 * token carries, so `groups` is empty **and means nothing**. Read the membership from the realm
 * instead — `organizationGroups` on `./server` is the sketch of that — and never read the empty
 * list as "in no group".
 */
export interface Organization {
  readonly alias: string;
  readonly id?: string;
  readonly roles: readonly string[];
  readonly groups: readonly string[];
  readonly groupsOverage: boolean;
}

/**
 * The whole of what the client knows about who is signed in.
 *
 * **Membership and the current organization are two different things, and only the first is
 * stored.** Membership is stable and comes from the token. Which organization a request is *in* is
 * a property of that request — its host, its path, a cookie — so `organization` is resolved per
 * request by the product's resolver and never written into the session record. That is what lets
 * two tabs sit in two organizations at once: there is no shared value for them to fight over.
 *
 * `roles` are the realm and client roles: global to the person. Roles held inside an organization
 * live on that `Organization`. They are kept apart on purpose, because merging them is how a role
 * granted in one organization comes to authorise something in another.
 */
export interface Session {
  readonly user: AuthUser;
  readonly roles: readonly string[];
  readonly organizations: readonly Organization[];
  /**
   * The alias of the organization this request addresses, as the product's resolver answered it.
   *
   * An address, not a proof of membership: `can` answers `false` for an organization the person
   * does not belong to, which is how a product tells "not a member here" from "no tenant".
   */
  readonly organization?: string;
  /**
   * Epoch milliseconds: when the access token expires, which is when the next renewal is due. The
   * client never uses it to decide access.
   */
  readonly expiresAt: number;
}

/** Where to come back to, and which organization to ask for, when sending someone to the IdP. */
export interface SignInOptions {
  /** Defaults to the current URL. */
  readonly returnTo?: string;
  /**
   * Ask Keycloak for one organization's scope in place of `organization:*`, which every sign-in
   * otherwise requests — plain `organization` would make Keycloak prompt for a choice.
   */
  readonly organization?: string;
}

/**
 * What a product holds in the browser: the seam between the hooks and the session behind them.
 *
 * RFC 10017 names three architectures for browser applications, and this package implements the
 * one it recommends for business applications: a **Backend For Frontend**, where the token never
 * reaches the browser and a cookie carries the session. `bffAuth` is that implementation. The
 * interface stays an interface so `useSession`, `Gate` and a test double are written against what
 * a session *does*, not against the transport underneath.
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
  /** A `fetch` that stays authenticated: the cookie rides along, and one retry after a renewal. */
  readonly fetch: typeof globalThis.fetch;
}

/**
 * Why a credential was refused, or who did not answer when one was asked for, as a code a product
 * can route on.
 *
 * A boolean cannot be acted upon: "not signed in" sends the person to the IdP, "signed in but not a
 * member" sends them to a page that says so, and "the IdP did not answer" sends them nowhere — it is
 * an outage to name, and sending them to sign in is the loop that hides it. The codes are
 * `area/kind`, the grammar one host registry keys fossil's codes, the rest of kanzo-ui's and its own
 * server's in.
 *
 * **A programming or deployment fault is not one**: `useSession` called outside its provider, or a
 * session too large for a cookie, both throw a plain `Error` on purpose. Giving those codes would
 * invite a product to `catch` them beside a refusal and route them to a sign-in page, which is the
 * wrong answer to "you wired this up wrong".
 *
 * *What would reverse it:* a product needing to route on one of those programmatically rather than
 * read it in a stack trace. None has; both are faults you fix once, not conditions you handle.
 */
export type AuthErrorCode =
  /** The claims carry no `sub`. Not a session at all — a configuration or IdP fault, never a user's. */
  | "claims/no-subject"
  /** There is no session. The person has not signed in, or it expired. */
  | "session/absent"
  /**
   * The session could not be read: the session store failed, or the BFF's session endpoint answered
   * something other than a session or a 401. `data.status` is that answer's status.
   */
  | "session/unavailable"
  /**
   * The session did not answer within `data.after` milliseconds: in the browser, the BFF's session
   * endpoint; on the server, a `ticketStore`'s adapter — reported there as the cause of a
   * `session/unavailable`.
   */
  | "session/silent"
  /**
   * The organization asked for is not an alias, so it was not put into a scope.
   *
   * The value reaches `begin` from a query parameter on every product with an organization
   * switcher: a space in it is scope injection, and a product wants to answer "no such
   * organization" rather than let an unreadable 400 arrive at someone who typed a link wrong.
   */
  | "organization/invalid"
  /**
   * The realm would not issue a token for the organization asked for: the person is not a member of
   * it. A resource server is never called with a token that names no organization in its place.
   */
  | "organization/denied"
  /** The callback's `state` is absent, different, or has no transaction to match against. */
  | "callback/state-mismatch"
  /** The ID token's `nonce` is not the one that was sent — a replay. */
  | "callback/nonce-mismatch"
  /**
   * The token endpoint refused the authorization code or answered with something unusable — no ID
   * token, no access token, a client it does not recognise. A deployment fault or a replayed code.
   */
  | "token/exchange-failed"
  /**
   * A token was refused and the session is over: the IdP answered `invalid_grant` to the refresh
   * token (its SSO session went idle, or was ended), or a back-channel logout token did not verify.
   */
  | "token/refused"
  /**
   * The session store cannot end a session from the server: a stateless store keeps the session in
   * the cookie, and a ticket adapter without `keys` cannot find a person's sessions. A back-channel
   * logout answers 501 for it.
   */
  | "session/irrevocable"
  /** The IdP could not be reached, or answered with something that is not OAuth — a 5xx, a proxy page. */
  | "idp/unreachable"
  /** The IdP did not answer within `data.after` milliseconds. */
  | "idp/silent";

export class AuthError extends Error {
  override readonly name = "AuthError";
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly data: { readonly after?: number; readonly status?: number } = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
