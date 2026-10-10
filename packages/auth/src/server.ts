import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  refreshTokenGrant,
  authorizationCodeGrant,
  genericGrantRequest,
  type Configuration,
} from "openid-client";
import { jwtVerify, type JWTPayload } from "jose";
import { claims } from "./claims";
import { sealedCookie, type SealedCookie } from "./cookie-session";
import { DEADLINE } from "./deadline";
import { DEFAULT_RENEW_WITHIN } from "./renew-within";
import { issuer, type IssuerConfig } from "./issuer";
import { keyedSingleFlight } from "./single-flight";
import { statelessStore, type SessionRecord, type SessionStore } from "./store";
import { AuthError, type AuthErrorCode, type Session, type SignInOptions } from "./types";

/**
 * `@kanzo-tech/auth/server` — the confidential OAuth client.
 *
 * This is the server half of the Backend For Frontend, which RFC 10017 calls *"strongly
 * recommended for business applications, sensitive applications, and applications that handle
 * personal data"*. The tokens live here and the browser gets a cookie it cannot read.
 *
 * **Nothing in this file implements OAuth.** `openid-client` does the flow, the ID token
 * verification and the end-session URL; `jose` does the sealing. What is written here is the
 * three-line sequence a route handler needs, the cookie discipline around it, and the reading of
 * Keycloak's claims into our one `Session` — which is the only part no library could have.
 *
 * ## The one thing that must never change
 *
 * **This module must not reach React.** It imports its siblings directly — `./claims`, never
 * `./index` — because importing the root barrel would drag React into a Node process. That is not
 * a hypothetical: it is the exact defect that forced `@kanzo-tech/mosaic` out of
 * `@kanzo-tech/ui`, and `server.test.ts` asserts it over source.
 *
 * ## Framework-agnostic on purpose
 *
 * Strings in, strings out: a URL and a `Cookie` header go in, a URL and `Set-Cookie` values come
 * out. `./next` is a thin wrapper over this, and so is anything else — there is no `Request` in
 * the signatures because a `Request` would make Next's flavour of it the one that fits.
 */

/**
 * `organization:*` is always asked for: membership of every organization arrives in one token, and
 * which one a request is *in* is the product's resolver's answer, per request. Plain
 * `organization` would make Keycloak prompt for a choice at sign-in instead.
 */
const DEFAULT_SCOPE = "openid profile email organization:*";
/** Eight hours: a working day, after which the refresh token is the thing keeping you signed in. */
const DEFAULT_MAX_AGE = 8 * 60 * 60;
/** Ten minutes is long enough to type a password and short enough that an abandoned leg expires. */
const TRANSACTION_MAX_AGE = 10 * 60;
/**
 * What `randomState()` mints — 43 characters of base64url — with room for another client's. The
 * callback's `state` names a cookie, so it is checked before it is spelled into one.
 */
const STATE = /^[A-Za-z0-9_-]{16,128}$/;
/** The event a logout token carries, OpenID Connect Back-Channel Logout 1.0 §2.4. */
const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";
/** OAuth 2.0 Token Exchange, RFC 8693 §2.1 and §3: the grant, and the one token type exchanged. */
const TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
/**
 * A client id as a scope may carry it. The audience is a client scope's name (modules/api names the
 * scope as the client), and a scope is a space-delimited list, so a space would be a second scope.
 */
const AUDIENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,254}$/;

function refuse(code: AuthErrorCode, message: string, cause?: unknown): never {
  throw new AuthError(code, message, {}, cause === undefined ? undefined : { cause });
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * A nonce mismatch, told apart from every other reason a grant can fail.
 *
 * `oauth4webapi` reports every failed claim comparison under one code and names the offending
 * claim on a `cause`, and `openid-client` re-wraps that in a `ClientError` — so the claim's name
 * is two `cause` hops down. Reading it is the only way to answer "which check failed", which is
 * the whole point of having codes rather than a 401. The walk is bounded because a cause chain is
 * data from a library, not something to trust to terminate.
 */
function isNonceMismatch(error: unknown): boolean {
  const code = codeOf(error);

  // A *wrong* nonce is a claim comparison, and the claim's name is carried structurally.
  if (code === "OAUTH_JWT_CLAIM_COMPARISON_FAILED") {
    let node: unknown = error;
    for (let depth = 0; depth < 4 && typeof node === "object" && node !== null; depth++) {
      if ((node as { claim?: unknown }).claim === "nonce") return true;
      node = (node as { cause?: unknown }).cause;
    }
    return false;
  }

  // A *missing* nonce is reported as a malformed response instead, and the claim's name appears
  // only in the message. Matching on a library's prose is brittle, and the answer to that is the
  // test that pins it rather than a quieter code: if `oauth4webapi` rewords this, a test fails
  // here instead of production silently reclassifying a replay as a transport problem.
  return (
    code === "OAUTH_INVALID_RESPONSE" &&
    error instanceof Error &&
    error.cause instanceof Error &&
    error.cause.message.includes('"nonce"')
  );
}

/**
 * A failure that looks like the signing keys we hold are no longer the ones Keycloak signs with.
 *
 * Keycloak rotates its realm keys, and a client holding a cached JWKS sees a key id it has never
 * heard of. A resource server answers it the same way: re-fetch the metadata *once, on
 * a failure*, and retry. Refreshing on a timer instead would be a request every few minutes that
 * is wrong exactly when it matters.
 *
 * **This path is only reachable with `verifySignatures`.** Without it no key material is consulted
 * during a code grant at all — the channel vouches for the ID token — so there is nothing to go
 * stale. The Rust needed the retry unconditionally because `openidconnect` verifies the signature
 * either way; that is a difference between the two libraries, not between the two designs.
 */
function isStaleKeyMaterial(error: unknown): boolean {
  return codeOf(error) === "OAUTH_KEY_SELECTION_FAILED";
}

/**
 * Who did not answer, when it was the IdP: `openid-client` reports its own deadline as
 * `OAUTH_TIMEOUT`, a status that is not OAuth's (a 502 from a proxy) as `OAUTH_RESPONSE_IS_NOT_CONFORM`,
 * and a connection that never opened as the platform's uncoded `TypeError`. `jose`, fetching the
 * keys a logout token is checked against, reports its deadline as `ERR_JWKS_TIMEOUT` and a key set
 * that is not one as `ERR_JWKS_INVALID`, or as its generic error for a status that is not 200.
 */
function unanswered(error: unknown): "idp/silent" | "idp/unreachable" | undefined {
  const code = codeOf(error);
  if (code === "OAUTH_TIMEOUT" || code === "ERR_JWKS_TIMEOUT") return "idp/silent";
  if (
    code === "OAUTH_RESPONSE_IS_NOT_CONFORM" ||
    code === "ERR_JWKS_INVALID" ||
    code === "ERR_JOSE_GENERIC"
  ) {
    return "idp/unreachable";
  }
  if (error instanceof TypeError && code === undefined) return "idp/unreachable";
  return undefined;
}

/**
 * The token endpoint's `invalid_grant` for a refresh token: Keycloak's answer once the SSO session
 * behind it has gone idle, been ended, or the token was already rotated by someone else.
 * `openid-client` carries the OAuth error on the `error` field of its `ResponseBodyError`.
 */
function isInvalidGrant(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { error?: unknown }).error === "invalid_grant"
  );
}

/**
 * The scope a sign-in asks for: the configured one with its organization scope replaced by
 * `organization:<alias>` when one is named, and by `organization:*` otherwise. Exactly one
 * organization scope, because Keycloak gives no promise about which of two would win.
 */
function scopeFor(configured: string | undefined, organization: string | undefined): string {
  const others = (configured ?? DEFAULT_SCOPE)
    .split(/\s+/)
    .filter((scope) => scope !== "" && scope !== "organization" && !scope.startsWith("organization:"));
  return [...others, `organization:${organization ?? "*"}`].join(" ");
}

/**
 * A Keycloak organization alias, or `*`. Anything else is not put into a scope string.
 *
 * `scope` is a **space-delimited list**, so a value with a space in it does not become one scope
 * with a space in it — it becomes two scopes, and the second one is whatever the caller wrote.
 * `?organization=x%20offline_access` reaching `begin` unchecked is an authorization request for
 * `offline_access`, which is a refresh token that outlives the browser session, asked for by
 * whoever composed the link. That is scope injection, and the place to stop it is here rather than
 * at whichever door happened to be the one taking query parameters today.
 *
 * The alphabet is Keycloak's own for an alias — it is a hostname-ish name, and the realm will not
 * mint one outside this set — plus the `*` that asks for every organization at once.
 */
const ORGANIZATION = /^(\*|[A-Za-z0-9](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9])?)$/;

/**
 * One renewal per ticket, for the whole process rather than per `relyingParty`.
 *
 * `singleFlight`'s own header says why a second concurrent renewal is a revoked token chain and
 * not a wasted round trip. The ticket names the session and no longer changes when the session is
 * renewed, so it is the right key: the proxy, the API forwarder and the refresh route all renew the
 * same session under the same name, and whichever asks second joins the first.
 *
 * **It is per process.** Two Node instances behind a load balancer can still both spend the same
 * refresh token, and the loser is told `invalid_grant`. That is answered in `renew` by reading the
 * record again — the winner has already written the rotated token under the same ticket — rather
 * than by a lock here, which would be a distributed one pretending to be a `Map`.
 */
const renewals = keyedSingleFlight<Adopted | Ended>();

/** The deployment's store, failing as `session/unavailable` rather than as whatever its driver throws. */
function reachable(store: SessionStore): SessionStore {
  const guard =
    <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await call(...args);
      } catch (error) {
        // A store that cannot revoke answered, and its answer is the point; it is not an outage.
        if (error instanceof AuthError && error.code === "session/irrevocable") throw error;
        return refuse("session/unavailable", "the session store did not answer", error);
      }
    };
  return {
    put: guard((record) => store.put(record)),
    update: guard((ticket, record) => store.update(ticket, record)),
    get: guard((ticket) => store.get(ticket)),
    drop: guard((ticket) => store.drop(ticket)),
    dropAll: guard((subject) => store.dropAll(subject)),
  };
}

/** What `begin` and `end` answer: where to send the browser, and what to set on the way. */
export interface Redirect {
  readonly url: string;
  readonly cookies: readonly string[];
}

/**
 * A live session after `refresh`: renewed, or still good. `cookies` is empty unless the ticket
 * itself changed, which only a stateless store's re-seal does.
 */
export interface Renewed {
  readonly ended: false;
  readonly session: Session;
  readonly cookies: readonly string[];
}

/**
 * No live session: none was presented, the store no longer knows it, or the IdP refused to renew
 * it. The ticket has been dropped, and `cookies` clears the one the browser holds — empty when it
 * held none.
 *
 * A result rather than an exception, because the cookies are the point: an ended session that
 * forgets to clear its cookie is the zombie this replaced, a page drawn for a session the IdP had
 * already closed.
 */
export interface Ended {
  readonly ended: true;
  /** `token/refused` when the IdP refused to renew it; `session/absent` when there was none to renew. */
  readonly code: "session/absent" | "token/refused";
  readonly cookies: readonly string[];
}

/** What `complete` answers: the new session, its cookies, and where the person was going. */
export interface SignedIn {
  readonly session: Session;
  readonly cookies: readonly string[];
  readonly returnTo: string;
}

/**
 * What `token` answers for a live session: the credential one resource server takes, issued for
 * it and for one organization, and what to set.
 */
export interface Token extends Renewed {
  readonly accessToken: string;
}

/**
 * Who a token is for: one resource server, and the organization a call is made in. RFC 9700 §2.3
 * restricts an access token to one resource server, and Keycloak's own advice for an exchange is
 * *"ideally use a single audience"*.
 */
export interface Audience {
  /**
   * The API's client id in the realm: the `aud` it validates, and the client scope that puts it
   * there (`services/auth/modules/api`), which the application lists in its `apis`.
   */
  readonly audience: string;
  /**
   * The organization the call is in: `organization:<alias>`, so the token names that organization
   * alone. Absent for an API no organization owns, and the token then names none.
   */
  readonly organization?: string;
}

/**
 * Everything a successful renewal produced: what the caller is told, and the record behind it.
 *
 * The two are separate and only the first is ever returned from a public method, because a
 * `SessionRecord` holds the refresh token and a `Renewed` is the sort of thing a route handler
 * writes straight into a response body. Structural typing would have let one extra field ride
 * along unnoticed all the way to the browser.
 */
/** An exchanged token and when it expires, epoch milliseconds — unknown when the realm did not say. */
interface Exchanged {
  readonly accessToken: string;
  readonly expiresAt: number | undefined;
}

interface Adopted {
  readonly renewed: Renewed;
  readonly record: SessionRecord;
}

export interface RelyingPartyConfig extends IssuerConfig {
  /** Seals the cookies. Any length; generate it. See `sealedCookie`. */
  readonly secret: string | Uint8Array;
  /**
   * Default `openid profile email organization:*`. Whatever is given, its organization scope is
   * `organization:*` — or the one alias a sign-in names.
   */
  readonly scope?: string;
  /** Default {@link statelessStore}. Supply a `ticketStore` to end a session before it expires. */
  readonly store?: SessionStore;
  /** Session cookie lifetime in seconds. Default eight hours. */
  readonly maxAge?: number;
  /** Where Keycloak sends the browser after sign-out. Must be registered as a post-logout URI. */
  readonly postLogoutRedirectUri?: string;
}

export interface RelyingParty {
  /**
   * Leg one: the authorization URL, and the cookie that remembers this attempt.
   *
   * `redirectUri` is per call, because it is derived from the request that asked, and one relying
   * party serves every origin a deployment answers on.
   */
  begin(options: SignInOptions & { readonly redirectUri: string }): Promise<Redirect>;
  /**
   * Leg two: the callback URL Keycloak returned to, the `Cookie` header it arrived with, and the
   * `redirectUri` `begin` was given — which the token request must repeat exactly.
   */
  complete(request: {
    readonly url: string | URL;
    readonly cookie: string | null;
    readonly redirectUri: string;
  }): Promise<SignedIn>;
  /** The session a request carries, or `null`. One store read; nothing is renewed. */
  read(cookie: string | null | undefined): Promise<Session | null>;
  /**
   * A token for one resource server and one organization — or {@link Ended} when there is no live
   * session.
   *
   * This is the *token-mediating backend*: the browser holds a cookie, the resource server is
   * given a bearer token, and the two never meet. The session's own token never leaves this
   * server: it names every organization the person belongs to and no API, and it is exchanged
   * (OAuth 2.0 Token Exchange, RFC 8693, as Keycloak's standard token exchange implements it) for
   * one whose `aud` is `audience` alone and whose organization is `organization` alone. The
   * session is renewed first when it is within `renewWithin` seconds of expiry (default 60).
   *
   * Exchanged tokens are kept until they are within the same window of expiry, one per session,
   * audience and organization, and an exchange is single-flight under that key: a page that fires
   * eight requests costs the realm one exchange, not eight.
   *
   * Rejects with `organization/denied` when the realm grants the token without the organization —
   * the person is not a member of it — and with `organization/invalid` for one that is not an alias.
   */
  token(
    cookie: string | null | undefined,
    options: Audience & { readonly renewWithin?: number },
  ): Promise<Token | Ended>;
  /**
   * Renew the session: spend the refresh token now or, with `renewWithin`, only when its access
   * token is within that many seconds of expiry. Single-flight per ticket, so a page that fires
   * eight requests at an expiring session spends the refresh token once.
   */
  refresh(
    cookie: string | null | undefined,
    options?: { readonly renewWithin?: number },
  ): Promise<Renewed | Ended>;
  /** RP-initiated logout: forget the record here, clear the cookie, and end it at the IdP too. */
  end(cookie: string | null | undefined, options?: { readonly returnTo?: string }): Promise<Redirect>;
  /**
   * Back-channel logout, OpenID Connect Back-Channel Logout 1.0 §2.6: verify the logout token
   * Keycloak posted, and drop every session it names.
   *
   * Rejects with `token/refused` for a token that does not verify, and `session/irrevocable` for a
   * store that cannot end a session from here.
   */
  logout(logoutToken: string): Promise<void>;
}

/** Everything either grant returns: one type, because both are answers from the token endpoint. */
type Tokens = Awaited<ReturnType<typeof refreshTokenGrant>>;

/** What the session cookie carries: a ticket into the store, and nothing a browser could use. */
interface SessionTicket {
  readonly ticket: string;
}

/** What a transaction cookie carries between the two legs. */
interface Transaction {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly returnTo: string;
}

export function relyingParty(config: RelyingPartyConfig): RelyingParty {
  const provider = issuer(config);
  const store = reachable(config.store ?? statelessStore());
  const after = DEADLINE;

  /** A failure to reach the IdP, coded by who did not answer; anything else as `fallback`. */
  const fromIdp = (error: unknown, fallback: AuthErrorCode, message: string): AuthError => {
    const code = unanswered(error) ?? fallback;
    return new AuthError(code, message, code === "idp/silent" ? { after } : {}, { cause: error });
  };

  /** Discovery, failing as the IdP's outage rather than as an uncoded error. */
  const configuration = async (): Promise<Configuration> => {
    try {
      return await provider.configuration();
    } catch (error) {
      throw fromIdp(error, "idp/unreachable", "the IdP's discovery document could not be read");
    }
  };

  const session: SealedCookie<SessionTicket> = sealedCookie({
    name: "kanzo-session",
    secret: config.secret,
    maxAge: config.maxAge ?? DEFAULT_MAX_AGE,
  });

  /**
   * One cookie per attempt, named by its `state` — Auth0's `__txn_{state}`. A single transaction
   * cookie is overwritten by the second tab that starts signing in, and the first tab's callback
   * then finds someone else's attempt and fails; per-state cookies let both finish. Each lives ten
   * minutes and is cleared by the callback that spends it.
   */
  const transaction = (state: string): SealedCookie<Transaction> =>
    sealedCookie({ name: `kanzo-auth.${state}`, secret: config.secret, maxAge: TRANSACTION_MAX_AGE });

  /** The ticket a request's cookie carries and the record behind it, or `null` for no cookie. */
  const opened = async (
    cookie: string | null | undefined,
  ): Promise<{ readonly ticket: string; readonly record: SessionRecord | null } | null> => {
    const sealed = await session.read(cookie);
    if (sealed === null) return null;
    return { ticket: sealed.ticket, record: await store.get(sealed.ticket) };
  };

  const ended = async (
    ticket: string | undefined,
    code: Ended["code"] = "session/absent",
  ): Promise<Ended> => {
    if (ticket !== undefined) await store.drop(ticket);
    return { ended: true, code, cookies: ticket === undefined ? [] : [session.clear()] };
  };

  /** What a grant produced, as the record to keep: the identity, the tokens, and the IdP session. */
  const adopt = (tokens: Tokens, previous: SessionRecord | null): SessionRecord => {
    // A refresh that returns no new ID token leaves the identity as it was; only the tokens moved.
    const idClaims = tokens.claims();
    const identity = idClaims === undefined ? previous?.session : claims(idClaims, config);
    if (identity === undefined) {
      refuse("token/exchange-failed", "the token response carried no ID token, so it names nobody");
    }

    // `expiresIn()` counts down from the moment the response was parsed, which is the only honest
    // reading: the token endpoint says `expires_in`, never an absolute time, because it has no
    // opinion about our clock. Absent, the expiry is unknown rather than zero — a record that
    // claimed to have expired at the epoch would be renewed on every single request.
    const lifetime = tokens.expiresIn();
    const accessTokenExpiresAt = lifetime === undefined ? undefined : Date.now() + lifetime * 1000;
    const sid = typeof idClaims?.["sid"] === "string" ? idClaims["sid"] : previous?.sid;

    return {
      session: { ...identity, expiresAt: accessTokenExpiresAt ?? identity.expiresAt },
      sid,
      accessToken: tokens.access_token,
      accessTokenExpiresAt,
      // RFC 10017 requires rotation, so the newly issued token is the only one still valid. An
      // authorization server that did not rotate returns none, and the one we hold stays good.
      refreshToken: tokens.refresh_token ?? previous?.refreshToken,
      idToken: tokens.id_token ?? previous?.idToken,
    };
  };

  /**
   * Spend the refresh token and write what comes back under the same ticket.
   *
   * Duende BFF's shape: the server-side session is updated in place, so the cookie naming it does
   * not change and a renewal in the proxy has nothing to hand the browser. A refusal is the end of
   * the session — unless the refusal is because another process got there first, which the
   * record, re-read once, says.
   */
  const renew = (ticket: string, record: SessionRecord): Promise<Adopted | Ended> =>
    renewals(ticket, async () => {
      const spent = record.refreshToken;
      if (spent === undefined) return ended(ticket);

      let tokens: Tokens;
      try {
        tokens = await refreshTokenGrant(await configuration(), spent);
      } catch (error) {
        if (error instanceof AuthError) throw error;
        // An IdP that did not answer has refused nothing, and a token endpoint that refused for any
        // reason but the grant is a deployment fault: neither ends the session.
        if (unanswered(error) !== undefined || !isInvalidGrant(error)) {
          throw fromIdp(error, "token/exchange-failed", "the token endpoint did not renew the session");
        }
        const current = await store.get(ticket);
        if (current?.refreshToken !== undefined && current.refreshToken !== spent) {
          return { record: current, renewed: { ended: false, session: current.session, cookies: [] } };
        }
        return ended(ticket, "token/refused");
      }

      const fresh = adopt(tokens, record);
      const next = await store.update(ticket, fresh);
      // The row went while the grant was in flight: a back-channel logout ended this session, and
      // the tokens just issued are for nobody.
      if (next === null) return ended(ticket);
      return {
        record: fresh,
        renewed: {
          ended: false,
          session: fresh.session,
          cookies: next === ticket ? [] : [await session.seal({ ticket: next })],
        },
      };
    });

  /**
   * The session's access token, renewed in place when it is within `within` milliseconds of expiry,
   * or {@link Ended}. It is what an exchange presents, and it is never handed to a caller.
   */
  const live = async (
    cookie: string | null | undefined,
    within: number,
  ): Promise<(Renewed & { readonly accessToken: string }) | Ended> => {
    const found = await opened(cookie);
    if (found?.record == null) return ended(found?.ticket);
    const { ticket, record } = found;

    // An unknown expiry is not treated as expired: a realm that omits `expires_in` would otherwise
    // be renewed on every request, which is the replay this package exists to avoid.
    const stale =
      record.accessTokenExpiresAt !== undefined && record.accessTokenExpiresAt - Date.now() <= within;

    if (record.accessToken !== undefined && !stale) {
      return { ended: false, accessToken: record.accessToken, session: record.session, cookies: [] };
    }

    const outcome = await renew(ticket, record);
    if ("ended" in outcome) return outcome;
    if (outcome.record.accessToken === undefined) {
      refuse("token/exchange-failed", "the token response carried no access token");
    }
    return { ...outcome.renewed, accessToken: outcome.record.accessToken };
  };

  /**
   * Exchanged tokens, keyed by the session token they came from, the audience and the organization.
   * The session token is the key rather than the ticket because it is what the exchange presented:
   * a renewed session is a new key, and the old entries age out with the tokens they hold. Pruned
   * on every write, so the map is bounded by the tokens still alive and not by who ever signed in.
   */
  const exchanged = new Map<string, Exchanged>();
  const exchanges = keyedSingleFlight<Exchanged>();

  /**
   * The audience is asked for by its scope and not by RFC 8693's `audience` parameter: Keycloak
   * reads that parameter as a filter, and keeps only the requested audience's client roles — so
   * the application's own roles, the ones `resource_access.<clientId>` carries outside any
   * organization, would not reach the API. The scope's audience mapper names the API without
   * filtering anything (measured on Keycloak 26.8 by `services/auth/scripts/verify.sh`).
   */
  const exchange = async (
    subject: string,
    audience: string,
    organization: string | undefined,
  ): Promise<Exchanged> => {
    const wanted = organization === undefined ? undefined : `organization:${organization}`;
    let tokens: Awaited<ReturnType<typeof genericGrantRequest>>;
    try {
      tokens = await genericGrantRequest(await configuration(), TOKEN_EXCHANGE, {
        subject_token: subject,
        subject_token_type: ACCESS_TOKEN_TYPE,
        requested_token_type: ACCESS_TOKEN_TYPE,
        scope: wanted === undefined ? audience : `${audience} ${wanted}`,
      });
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw fromIdp(error, "token/exchange-failed", `the session's token was not exchanged for \`${audience}\``);
    }

    // Keycloak drops an organization the person is not a member of rather than refusing the grant,
    // and says so in the granted scope (RFC 6749 §5.1: present when it differs from the request).
    // Reading the response's `scope` keeps the access token opaque here, as it is by contract.
    if (wanted !== undefined && tokens.scope !== undefined && !tokens.scope.split(" ").includes(wanted)) {
      refuse("organization/denied", `the realm did not grant \`${wanted}\`: the person is not a member`);
    }

    const lifetime = tokens.expiresIn();
    const fresh: Exchanged = {
      accessToken: tokens.access_token,
      expiresAt: lifetime === undefined ? undefined : Date.now() + lifetime * 1000,
    };
    const now = Date.now();
    for (const [key, entry] of exchanged) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) exchanged.delete(key);
    }
    exchanged.set([subject, audience, organization ?? ""].join(" "), fresh);
    return fresh;
  };

  /** A logout token's verification failure, as the IdP's outage or as a refused token. */
  const fromLogout = (error: unknown): AuthError =>
    error instanceof AuthError
      ? error
      : fromIdp(error, "token/refused", "the logout token did not verify");

  return {
    async begin(options) {
      const discovered = await configuration();

      const verifier = randomPKCECodeVerifier();
      const state = randomState();
      const nonce = randomNonce();

      if (options.organization !== undefined && !ORGANIZATION.test(options.organization)) {
        refuse(
          "organization/invalid",
          `\`${options.organization}\` is not an organization alias, and a scope is a space-delimited list: see ORGANIZATION`,
        );
      }

      const parameters: Record<string, string> = {
        redirect_uri: options.redirectUri,
        scope: scopeFor(config.scope, options.organization),
        code_challenge: await calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce,
      };

      return {
        url: buildAuthorizationUrl(discovered, parameters).href,
        cookies: [
          await transaction(state).seal({ state, nonce, verifier, returnTo: options.returnTo ?? "/" }),
        ],
      };
    },

    async complete(request) {
      const current = new URL(request.url);
      const state = current.searchParams.get("state");
      if (state === null || !STATE.test(state)) {
        refuse("callback/state-mismatch", "the callback carries no `state` this client could have sent");
      }

      const spent = transaction(state);
      const pending = await spent.read(request.cookie);
      if (pending === null || pending.state !== state) {
        refuse(
          "callback/state-mismatch",
          "the callback's `state` names no transaction this browser started",
        );
      }

      const checks = {
        pkceCodeVerifier: pending.verifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
      };

      // The token request repeats the `redirect_uri` the authorization request sent (RFC 6749
      // §4.1.3), and `openid-client` reads it off the URL it is handed — so the callback's own
      // parameters go onto that URI, whatever host the request happened to arrive under.
      const callback = new URL(request.redirectUri);
      callback.search = current.search;

      const grant = (configuration: Configuration) =>
        authorizationCodeGrant(configuration, callback, checks);

      let tokens: Tokens;
      try {
        tokens = await grant(await configuration());
      } catch (error) {
        if (error instanceof AuthError) throw error;
        if (isNonceMismatch(error)) {
          refuse(
            "callback/nonce-mismatch",
            "the ID token's `nonce` is not the one this transaction sent",
            error,
          );
        }
        if (!isStaleKeyMaterial(error)) {
          throw fromIdp(error, "token/exchange-failed", "the authorization code could not be exchanged");
        }
        // Keycloak rotated its signing key. One re-discovery, one retry, then give up — a loop
        // here is a self-inflicted denial of service against the identity provider.
        try {
          tokens = await grant(await provider.rediscover());
        } catch (retried) {
          if (isNonceMismatch(retried)) {
            refuse(
              "callback/nonce-mismatch",
              "the ID token's `nonce` is not the one this transaction sent",
              retried,
            );
          }
          throw fromIdp(
            retried,
            "token/exchange-failed",
            "the ID token did not verify, and did not verify against freshly discovered keys either",
          );
        }
      }

      // Session fixation: the record is new, the ticket is new and the cookie is new, and any
      // session cookie this callback happened to arrive with is not read. This is the only place a
      // ticket is issued; every renewal after it keeps this one.
      const record = adopt(tokens, null);
      const ticket = await store.put(record);

      return {
        session: record.session,
        cookies: [await session.seal({ ticket }), spent.clear()],
        returnTo: pending.returnTo,
      };
    },

    async read(cookie) {
      return (await opened(cookie))?.record?.session ?? null;
    },

    async token(cookie, options) {
      const { audience, organization } = options;
      if (!AUDIENCE.test(audience)) {
        // The deployment's own configuration, not a request's: a fault to fix, not a refusal.
        throw new Error(`\`${audience}\` is not a client id, and a scope is a space-delimited list`);
      }
      if (organization !== undefined && (organization === "*" || !ORGANIZATION.test(organization))) {
        refuse(
          "organization/invalid",
          `\`${organization}\` is not one organization alias, and a token is for one organization`,
        );
      }

      const within = (options.renewWithin ?? DEFAULT_RENEW_WITHIN) * 1000;
      const held = await live(cookie, within);
      if (held.ended) return held;

      const key = [held.accessToken, audience, organization ?? ""].join(" ");
      const kept = exchanged.get(key);
      const fresh =
        kept !== undefined && (kept.expiresAt === undefined || kept.expiresAt - Date.now() > within)
          ? kept
          : await exchanges(key, () => exchange(held.accessToken, audience, organization));
      return { ended: false, session: held.session, cookies: held.cookies, accessToken: fresh.accessToken };
    },

    async refresh(cookie, options = {}) {
      if (options.renewWithin !== undefined) {
        const held = await live(cookie, options.renewWithin * 1000);
        return held.ended ? held : { ended: false, session: held.session, cookies: held.cookies };
      }
      const found = await opened(cookie);
      if (found?.record == null) return ended(found?.ticket);
      const outcome = await renew(found.ticket, found.record);
      return "ended" in outcome ? outcome : outcome.renewed;
    },

    async end(cookie, options = {}) {
      const found = await opened(cookie);
      if (found !== null) await store.drop(found.ticket);

      const parameters: Record<string, string> = {};
      const returnTo = options.returnTo ?? config.postLogoutRedirectUri;
      if (returnTo !== undefined) parameters["post_logout_redirect_uri"] = returnTo;
      // Without the hint Keycloak cannot tell which session is ending and asks the person to
      // confirm — which reads as a bug to everyone who sees it.
      if (found?.record?.idToken !== undefined) parameters["id_token_hint"] = found.record.idToken;

      // `buildEndSessionUrl` rather than a hand-built URL: the endpoint comes from discovery, and
      // the parameter names are the specification's rather than ours to remember.
      return {
        url: buildEndSessionUrl(await configuration(), parameters).href,
        cookies: [session.clear()],
      };
    },

    async logout(logoutToken) {
      let payload: JWTPayload;
      try {
        // `jose` checks the signature against the realm's published keys, `iss`, `aud` and the
        // presence of `iat`, and `exp` when the token carries one. An unknown `kid` re-fetches the
        // key set once per cooldown, which is how a rotation is survived here.
        ({ payload } = await jwtVerify(logoutToken, await provider.keys(), {
          issuer: config.issuer,
          audience: config.clientId,
          requiredClaims: ["iat"],
        }));
      } catch (error) {
        throw fromLogout(error);
      }

      // §2.6 steps 4–6: the event is present, there is no `nonce` — which is what keeps an ID token
      // from being replayed as a logout token — and the token names a subject, a session, or both.
      const events = payload["events"];
      const event =
        typeof events === "object" && events !== null
          ? (events as Record<string, unknown>)[BACKCHANNEL_EVENT]
          : undefined;
      if (typeof event !== "object" || event === null) {
        refuse("token/refused", "the logout token does not carry the back-channel logout event");
      }
      if ("nonce" in payload) {
        refuse("token/refused", "a logout token must not carry a `nonce`");
      }
      const sub = typeof payload.sub === "string" ? payload.sub : undefined;
      const sid = typeof payload["sid"] === "string" ? payload["sid"] : undefined;
      if (sub === undefined) {
        // §2.4 allows a token with only `sid`. Tickets are keyed by subject first, so a session
        // could only be found by reading every ticket there is; Keycloak always sends `sub`.
        refuse(
          "token/refused",
          sid === undefined
            ? "the logout token names neither a subject nor a session"
            : "the logout token names a session but no subject, and sessions are found by subject",
        );
      }

      await store.dropAll({ sub, sid });
    },
  };
}

export { issuer, rewriteOrigin, type Issuer, type IssuerConfig } from "./issuer";
export {
  organizationGroups,
  type OrganizationGroups,
  type OrganizationGroupsConfig,
} from "./organization-groups";
export { sealedCookie, cookieValue, type SealedCookie, type SealedCookieConfig } from "./cookie-session";
export {
  statelessStore,
  ticketStore,
  type SessionRecord,
  type SessionStore,
  type SessionSubject,
  type TicketAdapter,
  type TicketStoreConfig,
} from "./store";
