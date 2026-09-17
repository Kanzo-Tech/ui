import {
  buildAuthorizationUrl,
  buildEndSessionUrl,
  calculatePKCECodeChallenge,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
  refreshTokenGrant,
  authorizationCodeGrant,
  type Configuration,
} from "openid-client";
import { claims } from "./claims";
import { sealedCookie, type SealedCookie } from "./cookie-session";
import { issuer, type IssuerConfig } from "./issuer";
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
 * `@kanzo-tech/ui`, and `scripts/smoke-install.mjs` asserts the built bytes for it.
 *
 * ## Framework-agnostic on purpose
 *
 * Strings in, strings out: a URL and a `Cookie` header go in, a URL and `Set-Cookie` values come
 * out. `./next` is a thin wrapper over this, and so is anything else — there is no `Request` in
 * the signatures because a `Request` would make Next's flavour of it the one that fits.
 */

const DEFAULT_SCOPE = "openid profile email";
/** Eight hours: a working day, after which the refresh token is the thing keeping you signed in. */
const DEFAULT_MAX_AGE = 8 * 60 * 60;
/** Ten minutes is long enough to type a password and short enough that an abandoned leg expires. */
const TRANSACTION_MAX_AGE = 10 * 60;

function refuse(code: AuthErrorCode, message: string, cause?: unknown): never {
  const error = new AuthError(code, message);
  if (cause !== undefined) error.cause = cause;
  throw error;
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
 * heard of. keasy's Rust learned this and answers it the same way: re-fetch the metadata *once, on
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

/** What `begin` and `end` answer: where to send the browser, and what to set on the way. */
export interface Redirect {
  readonly url: string;
  readonly cookies: readonly string[];
}

/** What `refresh` answers. */
export interface Renewed {
  readonly session: Session;
  readonly cookies: readonly string[];
}

/** What `complete` answers: a renewal, plus where the person was going before they were asked who they are. */
export interface SignedIn extends Renewed {
  readonly returnTo: string;
}

export interface RelyingPartyConfig extends IssuerConfig {
  /** Registered at Keycloak, and where `complete` expects to be called. */
  readonly redirectUri: string;
  /** Seals the cookies. Any length; generate it. See `sealedCookie`. */
  readonly secret: string | Uint8Array;
  /** Default `openid profile email`. A multi-tenant product adds `organization:*`. */
  readonly scope?: string;
  /** Default {@link statelessStore}. Supply one to invalidate a session before it expires. */
  readonly store?: SessionStore;
  /** Session cookie lifetime in seconds. Default eight hours. */
  readonly maxAge?: number;
  /** Where Keycloak sends the browser after sign-out. Must be registered as a post-logout URI. */
  readonly postLogoutRedirectUri?: string;
}

export interface RelyingParty {
  /** Leg one: the authorization URL, and the cookie that remembers this attempt. */
  begin(options?: SignInOptions): Promise<Redirect>;
  /** Leg two: the callback URL Keycloak returned to, and the `Cookie` header it arrived with. */
  complete(request: { readonly url: string | URL; readonly cookie: string | null }): Promise<SignedIn>;
  /** The session a request carries, or `null`. The read a route handler does on every request. */
  read(cookie: string | null | undefined): Promise<Session | null>;
  /** Spend the refresh token, take the new one, and reissue the cookie. */
  refresh(cookie: string | null | undefined): Promise<Renewed>;
  /** RP-initiated logout: forget the record here, clear the cookie, and end it at the IdP too. */
  end(cookie: string | null | undefined, options?: { readonly returnTo?: string }): Promise<Redirect>;
}

/** Everything either grant returns: one type, because both are answers from the token endpoint. */
type Tokens = Awaited<ReturnType<typeof refreshTokenGrant>>;

/** What the session cookie carries: a ticket into the store, and nothing a browser could use. */
interface SessionTicket {
  readonly ticket: string;
}

/** What the transaction cookie carries between the two legs. */
interface Transaction {
  readonly state: string;
  readonly nonce: string;
  readonly verifier: string;
  readonly returnTo: string;
}

export function relyingParty(config: RelyingPartyConfig): RelyingParty {
  const provider = issuer(config);
  const store = config.store ?? statelessStore();

  const session: SealedCookie<SessionTicket> = sealedCookie({
    name: "kanzo-session",
    secret: config.secret,
    maxAge: config.maxAge ?? DEFAULT_MAX_AGE,
  });

  // A second cookie rather than a field on the first, because its lifetime is different by two
  // orders of magnitude and it must be gone the moment the callback has used it.
  const transaction: SealedCookie<Transaction> = sealedCookie({
    name: "kanzo-auth",
    secret: config.secret,
    maxAge: TRANSACTION_MAX_AGE,
  });

  const recordFrom = async (cookie: string | null | undefined): Promise<SessionRecord | null> => {
    const sealed = await session.read(cookie);
    if (sealed === null) return null;
    return store.get(sealed.ticket);
  };

  /** Everything a successful grant produces, in the one place both grants can use it. */
  const adopt = async (tokens: Tokens, previous: SessionRecord | null): Promise<Renewed> => {
    // A refresh that returns no new ID token leaves the identity as it was; only the tokens moved.
    const idClaims = tokens.claims();
    const next = idClaims === undefined ? previous?.session : claims(idClaims, config);
    if (next === undefined) {
      refuse("token.exchange-failed", "the token response carried no ID token, so it names nobody");
    }

    const ticket = await store.put({
      session: next,
      // RFC 10017 requires rotation, so the newly issued token is the only one still valid. An
      // authorization server that did not rotate returns none, and the one we hold stays good.
      refreshToken: tokens.refresh_token ?? previous?.refreshToken,
      idToken: tokens.id_token ?? previous?.idToken,
    });

    return { session: next, cookies: [await session.seal({ ticket })] };
  };

  return {
    async begin(options = {}) {
      const configuration = await provider.configuration();

      const verifier = randomPKCECodeVerifier();
      const state = randomState();
      const nonce = randomNonce();

      const parameters: Record<string, string> = {
        redirect_uri: config.redirectUri,
        // `organization:<alias>` asks Keycloak for one; a product with many asks for
        // `organization:*` through `scope`, because plain `organization` prompts for a choice.
        scope:
          options.organization === undefined
            ? (config.scope ?? DEFAULT_SCOPE)
            : `${config.scope ?? DEFAULT_SCOPE} organization:${options.organization}`,
        code_challenge: await calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce,
      };

      return {
        url: buildAuthorizationUrl(configuration, parameters).href,
        cookies: [
          await transaction.seal({ state, nonce, verifier, returnTo: options.returnTo ?? "/" }),
        ],
      };
    },

    async complete(request) {
      const pending = await transaction.read(request.cookie);
      if (pending === null) {
        refuse(
          "callback.state-mismatch",
          "the callback arrived with no transaction cookie, so there is nothing to match its `state` against",
        );
      }

      const current = new URL(request.url);
      if (current.searchParams.get("state") !== pending.state) {
        refuse(
          "callback.state-mismatch",
          "the callback's `state` is not the one this browser was sent with",
        );
      }

      const checks = {
        pkceCodeVerifier: pending.verifier,
        expectedState: pending.state,
        expectedNonce: pending.nonce,
      };

      const grant = (configuration: Configuration) =>
        authorizationCodeGrant(configuration, current, checks);

      let tokens: Tokens;
      try {
        tokens = await grant(await provider.configuration());
      } catch (error) {
        if (isNonceMismatch(error)) {
          refuse(
            "callback.nonce-mismatch",
            "the ID token's `nonce` is not the one this transaction sent",
            error,
          );
        }
        if (!isStaleKeyMaterial(error)) {
          refuse("token.exchange-failed", "the authorization code could not be exchanged", error);
        }
        // Keycloak rotated its signing key. One re-discovery, one retry, then give up — a loop
        // here is a self-inflicted denial of service against the identity provider.
        try {
          tokens = await grant(await provider.rediscover());
        } catch (retried) {
          if (isNonceMismatch(retried)) {
            refuse(
              "callback.nonce-mismatch",
              "the ID token's `nonce` is not the one this transaction sent",
              retried,
            );
          }
          refuse(
            "token.exchange-failed",
            "the ID token did not verify, and did not verify against freshly discovered keys either",
            retried,
          );
        }
      }

      // Session fixation: the record is new, the ticket is new and the cookie is new, and any
      // session cookie this callback happened to arrive with is not read. keasy's Rust calls
      // `cycle_id()` here for the same reason — an attacker who planted a session before sign-in
      // must not find themselves holding the one that sign-in produced.
      const renewed = await adopt(tokens, null);

      return {
        ...renewed,
        cookies: [...renewed.cookies, transaction.clear()],
        returnTo: pending.returnTo,
      };
    },

    async read(cookie) {
      return (await recordFrom(cookie))?.session ?? null;
    },

    async refresh(cookie) {
      const sealed = await session.read(cookie);
      const record = sealed === null ? null : await store.get(sealed.ticket);
      if (sealed === null || record === null) {
        refuse("session.absent", "there is no session cookie to refresh");
      }
      if (record.refreshToken === undefined) {
        refuse("session.absent", "the session holds no refresh token, so it cannot be renewed");
      }

      let tokens: Tokens;
      try {
        tokens = await refreshTokenGrant(await provider.configuration(), record.refreshToken);
      } catch (error) {
        // Under rotation a refused refresh is often a *replayed* token rather than an expired one,
        // and the authorization server may have revoked the whole chain. Either way the session is
        // over; `single-flight.ts` exists to keep us from causing it.
        refuse("token.exchange-failed", "the refresh token was refused", error);
      }

      // The superseded ticket goes first: a store that enforces one live session per person must
      // not briefly hold two, and for the stateless default this is a no-op.
      await store.drop(sealed.ticket);
      return adopt(tokens, record);
    },

    async end(cookie, options = {}) {
      const sealed = await session.read(cookie);
      const record = sealed === null ? null : await store.get(sealed.ticket);
      if (sealed !== null) await store.drop(sealed.ticket);

      const parameters: Record<string, string> = {};
      const returnTo = options.returnTo ?? config.postLogoutRedirectUri;
      if (returnTo !== undefined) parameters["post_logout_redirect_uri"] = returnTo;
      // Without the hint Keycloak cannot tell which session is ending and asks the person to
      // confirm — which reads as a bug to everyone who sees it.
      if (record?.idToken !== undefined) parameters["id_token_hint"] = record.idToken;

      // `buildEndSessionUrl` rather than a hand-built URL: the endpoint comes from discovery, and
      // the parameter names are the specification's rather than ours to remember.
      return {
        url: buildEndSessionUrl(await provider.configuration(), parameters).href,
        cookies: [session.clear()],
      };
    },
  };
}

export { issuer, rewriteOrigin, type Issuer, type IssuerConfig } from "./issuer";
export { sealedCookie, cookieValue, type SealedCookie, type SealedCookieConfig } from "./cookie-session";
export { statelessStore, type SessionRecord, type SessionStore } from "./store";
