import { Problem } from "@kanzo-tech/kernel";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { claims } from "./claims";
import { withoutTrailingSlashes } from "./edge-url";
import type { Session } from "./types";

/**
 * The person, read from the access token the platform's edge hands the application.
 *
 * The relying party is oauth2-proxy (`services/auth`, `auth-proxy`): it signs the person in, keeps
 * the session, renews it and signs out, and passes the Keycloak access token on every request it
 * lets through as `X-Forwarded-Access-Token`. This module is what the application does with that
 * header, and it does not trust it: the token is verified against the realm's own keys — the
 * signature, `iss`, `exp`, and `azp` naming this application's client — before a claim is read.
 * That is defence in depth, and it is what makes a header that did not come through the proxy
 * worth nothing: anyone can set a header, and nobody but the realm can sign a token.
 *
 * `X-Forwarded-User` and `X-Forwarded-Email` are not read. They are the proxy's word, unsigned, and
 * the token carries both with the realm's signature on them.
 *
 * **This module must not reach React.** It imports its siblings directly — `./claims`, never
 * `./index` — because the root barrel would drag a provider into a Node process; `server.test.ts`
 * asserts it over source.
 */

/** Where the proxy puts the access token (oauth2-proxy's `--pass-access-token`). */
export const TOKEN_HEADER = "x-forwarded-access-token";

/**
 * One fetch of the realm's keys, in milliseconds: `jose` makes the request, so it is handed the
 * figure (`/docs/design/failure`, *one deadline per wait*): one request to the identity provider.
 */
export const KEYS_WITHIN = 10_000;

export interface SessionReaderConfig {
  /**
   * The issuer every token names, exactly as Keycloak writes it: the **public** one,
   * `https://id.example/realms/kanzo`. A token naming another is refused.
   */
  readonly issuer: string;
  /**
   * This application's client id. A token whose `azp` is not this one was issued to another
   * application and is refused; it is also the entry of `resource_access` the roles are read from.
   */
  readonly clientId: string;
  /**
   * Where this process reaches the realm's keys, when that is not where the browser reaches the
   * realm: `http://keycloak:8080/realms/kanzo/protocol/openid-connect/certs` inside a Compose
   * network. Defaults to the issuer's own, `{issuer}/protocol/openid-connect/certs`.
   */
  readonly jwks?: string;
}

/** The verified token, and the person it names. */
export interface Forwarded {
  readonly token: string;
  readonly session: Session;
}

/**
 * Who did not answer, when the keys could not be fetched: `jose` reports its own deadline as
 * `ERR_JWKS_TIMEOUT`, a body that is not a key set as `ERR_JWKS_INVALID`, a status that is not 200
 * as its generic error, and a connection that never opened is the platform's uncoded `TypeError`.
 * Anything else is a token that did not verify.
 */
function refusal(error: unknown): Problem {
  const code =
    typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : undefined;
  if (code === "ERR_JWKS_TIMEOUT") {
    return new Problem("idp/silent", `the realm's keys did not arrive within ${KEYS_WITHIN} ms`, { after: KEYS_WITHIN }, { cause: error });
  }
  if (code === "ERR_JWKS_INVALID" || code === "ERR_JOSE_GENERIC" || (error instanceof TypeError && code === undefined)) {
    return new Problem("idp/unreachable", "the realm's keys could not be fetched", {}, { cause: error });
  }
  return new Problem("token/refused", "the forwarded access token did not verify", {}, { cause: error });
}

/**
 * The reader `./next` builds on: the token and the session, or `null` when no token was forwarded.
 * Throws `token/refused` for a token that does not verify, and `idp/silent` or `idp/unreachable`
 * when the keys to verify it with could not be had.
 */
export function forwarded(config: SessionReaderConfig): (headers: Headers) => Promise<Forwarded | null> {
  const issuer = withoutTrailingSlashes(config.issuer);
  // `jose`'s remote set fetches on first use, keeps the keys, and fetches again — at most once per
  // cooldown — on a key id it has not seen, which is the answer to the realm rotating its keys.
  const keys = createRemoteJWKSet(new URL(config.jwks ?? `${issuer}/protocol/openid-connect/certs`), {
    timeoutDuration: KEYS_WITHIN,
  });

  return async (headers) => {
    const token = headers.get(TOKEN_HEADER);
    if (token === null || token === "") return null;

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keys, { issuer, requiredClaims: ["exp"] }));
    } catch (error) {
      throw refusal(error);
    }
    // `aud` names the APIs the token is for, and is theirs to check; `azp` names the client it was
    // issued to, and that is this application or the token is somebody else's.
    if (payload["azp"] !== config.clientId) {
      throw new Problem("token/refused", "the forwarded access token was issued to another client");
    }
    return { token, session: claims(payload, { clientId: config.clientId }) };
  };
}

/**
 * The one session reader: the person a request's headers carry, or `null` when the proxy forwarded
 * no token. Build it once; it keeps the realm's keys between requests.
 *
 * ```ts
 * const read = sessionReader({ issuer, clientId });
 * const session = await read(request.headers);
 * ```
 */
export function sessionReader(config: SessionReaderConfig): (headers: Headers) => Promise<Session | null> {
  const read = forwarded(config);
  return async (headers) => (await read(headers))?.session ?? null;
}
