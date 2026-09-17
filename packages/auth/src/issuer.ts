import {
  ClientSecretPost,
  PrivateKeyJwt,
  allowInsecureRequests,
  customFetch,
  enableNonRepudiationChecks,
  discovery,
  type ClientMetadata,
  type Configuration,
  type CryptoKey,
  type CustomFetch,
  type DiscoveryRequestOptions,
  type PrivateKey,
} from "openid-client";
import { singleFlight } from "./single-flight";

/**
 * Discovery and client configuration for the confidential client behind `./server`.
 *
 * Two things live here that a plain `discovery()` call does not give you, and both come from
 * running this against Keycloak in anger:
 *
 * 1. **The issuer's origin can be rewritten for server→Keycloak traffic.** The browser must be
 *    sent to the public issuer, and the server usually cannot reach it — in a cluster it reaches
 *    `http://keycloak:8080`. Rewriting the *transport* rather than the issuer keeps the two
 *    truthful at once: discovery still validates the `issuer` in the document against the public
 *    URL, because that is what Keycloak puts there.
 * 2. **Discovery is allowed to fail.** Keycloak is frequently not up when the application is, and
 *    a library that hides a retry loop inside itself takes that decision away from the caller. A
 *    failed discovery is simply not cached, so the *next* call tries again — the retry is the
 *    caller's `await`, on the caller's schedule.
 */

export interface IssuerConfig {
  /** The **public** issuer URL, exactly as Keycloak reports it: `https://id.example/realms/kanzo`. */
  readonly issuer: string;
  readonly clientId: string;
  /** Client secret authentication. Used when {@link IssuerConfig.privateKey} is absent. */
  readonly clientSecret?: string;
  /**
   * `private_key_jwt`, which is the stronger of the two: the secret never travels. Preferred
   * wherever the deployment can hold a key, and it wins over `clientSecret` when both are given.
   */
  readonly privateKey?: CryptoKey | PrivateKey;
  /**
   * Where *this process* reaches Keycloak, when that is not where the browser reaches it —
   * `http://keycloak:8080`. Only the origin is replaced; the path is the issuer's own.
   */
  readonly internalOrigin?: string;
  /** Injectable for tests, and the seam the origin rewrite is built on. Defaults to the global. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Allow a plain-HTTP issuer. A compose file on a laptop serves `http://localhost:8080`, and
   * without this nothing local can be configured at all. It is not needed for an HTTP
   * {@link IssuerConfig.internalOrigin}: the rewrite happens below the protocol check.
   */
  readonly allowInsecureHttp?: boolean;
  /**
   * Verify the ID token's signature, and not only its claims.
   *
   * **Defaults to whether the token endpoint is actually reached over TLS**, rather than to a flat
   * `false`. The specification lets a code grant skip this — an ID token arriving over a TLS
   * connection to the token endpoint, from a request authenticated as this client, is vouched for
   * by the channel (OpenID Connect Core §3.1.3.7 step 6) — and `openid-client` leaves it off for
   * that reason, which is why a sign-in fetches no JWKS at all.
   *
   * But the exemption is a claim *about the channel*, and an {@link IssuerConfig.internalOrigin} of
   * `http://keycloak:8080` withdraws it: the hop TLS was supposed to protect is plaintext inside
   * the cluster, so nothing is vouching for anything. Inheriting the reference's default there
   * would be inheriting its conclusion without its premise. So the default is derived from the
   * effective origin's protocol, and it can still be set explicitly either way.
   *
   * On, it costs one JWKS fetch, cached — and it is what makes {@link Issuer.rediscover} reachable
   * on a key rotation.
   */
  readonly verifySignatures?: boolean;
  /** Seconds. Applies to discovery and to every request the resulting configuration makes. */
  readonly timeout?: number;
}

/**
 * A configuration that discovers on demand.
 *
 * Holding the handle rather than the {@link Configuration} is what makes rotation expressible:
 * `rediscover()` throws the current one away, and with it the JWKS that openid-client cached
 * inside it.
 */
export interface Issuer {
  /** The configuration, discovering once and reusing it. Rejects — and caches nothing — on failure. */
  configuration(): Promise<Configuration>;
  /**
   * Discard what was discovered and fetch it again.
   *
   * This is the answer to signing-key rotation, and it is deliberately *reactive*: the trigger is
   * a verification that failed, never a timer. A timer refreshes when nothing is wrong and is
   * still stale at the moment something is.
   */
  rediscover(): Promise<Configuration>;
}

/**
 * A `fetch` that replaces one origin with another before sending.
 *
 * `from` may be any URL — its origin is what is taken — so the issuer URL itself can be passed
 * without the caller splitting it first. When the two origins are equal this is a pass-through,
 * which is why there is no second code path for "no rewrite configured".
 */
export function rewriteOrigin(
  from: string,
  to: string,
  base: typeof globalThis.fetch = globalThis.fetch,
): CustomFetch {
  const source = new URL(from).origin;
  const target = to.replace(/\/+$/, "");
  return (url, options) =>
    base(
      url.startsWith(source) ? `${target}${url.slice(source.length)}` : url,
      options as unknown as RequestInit,
    );
}

export function issuer(config: IssuerConfig): Issuer {
  const server = new URL(config.issuer);
  const base: typeof globalThis.fetch =
    config.fetch ?? ((input, init) => globalThis.fetch(input, init));

  const reachedAt = config.internalOrigin ?? server.origin;

  const options: DiscoveryRequestOptions = {
    [customFetch]: rewriteOrigin(config.issuer, reachedAt, base),
  };
  if (config.timeout !== undefined) options.timeout = config.timeout;

  // The channel is what the specification's exemption rests on, so the default asks whether there
  // is one rather than assuming it. Explicit beats derived in both directions.
  const overTls = new URL(reachedAt).protocol === "https:";
  const execute = [
    ...(config.allowInsecureHttp === true ? [allowInsecureRequests] : []),
    ...((config.verifySignatures ?? !overTls) ? [enableNonRepudiationChecks] : []),
  ];
  if (execute.length > 0) options.execute = execute;

  // `private_key_jwt` over a shared secret wherever the deployment can hold a key. `None()` is
  // absent on purpose: this door is the confidential client, and a public one belongs behind
  // `./browser` where PKCE alone is the protection.
  const clientAuth =
    config.privateKey !== undefined
      ? PrivateKeyJwt(config.privateKey)
      : ClientSecretPost(config.clientSecret);

  const metadata: Partial<ClientMetadata> =
    config.clientSecret !== undefined ? { client_secret: config.clientSecret } : {};

  let current: Configuration | undefined;

  // Single-flight for the reason it exists everywhere in this package: six requests arriving
  // during a cold start would otherwise each fetch the discovery document. Here the slot is
  // cleared on failure, which *is* the caller-driven retry — the next `await` starts a new attempt.
  const fetchOnce = singleFlight(async () => {
    const discovered = await discovery(server, config.clientId, metadata, clientAuth, options);
    current = discovered;
    return discovered;
  });

  return {
    async configuration() {
      return current ?? fetchOnce();
    },
    // A `rediscover()` that lands while a discovery is already running joins that one rather than
    // starting a newer one. It is the narrow price of single-flight, and it is bounded: the call
    // it joins is at most one request old, and a second failure rediscovers again.
    async rediscover() {
      current = undefined;
      return fetchOnce();
    },
  };
}
