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
 * instead — the realm's admin API, as `/docs/design/auth` sketches — and never read the empty list as
 * "in no group".
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
  /**
   * The session now, or `null`: read each time it is asked, and renewed first when it is near
   * expiry. It keeps no copy — `AuthProvider`'s query on the host's `QueryClient` is the one cache.
   */
  getSession(): Promise<Session | null>;
  /**
   * Call `onChange` when the session may have changed — renewed here, or loaded, renewed or signed
   * out in another tab — so the provider reads it again. Returns the unsubscribe.
   */
  subscribe(onChange: () => void): () => void;
  signIn(options?: SignInOptions): Promise<void>;
  signOut(options?: { readonly returnTo?: string }): Promise<void>;
  /**
   * A `fetch` that stays authenticated: the cookie rides along, and one retry after a renewal. It
   * bounds nothing: a request made through it carries its caller's own signal.
   */
  readonly fetch: typeof globalThis.fetch;
}
