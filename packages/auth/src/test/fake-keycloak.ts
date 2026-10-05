import { SignJWT, exportJWK, generateKeyPair } from "jose";

/**
 * A Keycloak that answers on a function instead of a socket, shared by every test that signs in.
 *
 * Everything the flow touches is real — RS256 key pairs, signed JWTs, JWKS selection and the
 * verification `openid-client` and `jose` do over them. Only the transport is ours, which is what
 * keeps the assertions about this package rather than about a stub agreeing with itself. It was
 * three trimmed copies once, and each copy had learned a different subset of what the realm can
 * do; one realm with every knob is the copy that cannot drift.
 *
 * Not part of the build: `vite.config.ts` keeps `src/test` out of the declarations, and nothing a
 * door reaches imports it.
 */

export const ISSUER = "https://id.example.test/realms/kanzo";
export const CLIENT_ID = "board";
export const ORIGIN = "https://app.example.test";
export const SECRET = "a-secret-nobody-chose-by-hand";

/** The event a logout token names, from OpenID Connect Back-Channel Logout 1.0 §2.4. */
export const BACKCHANNEL_EVENT = "http://schemas.openid.net/event/backchannel-logout";

/** Generated once per test file: two RSA pairs is a second of entropy, and the realm is rebuilt per test. */
const KEYS = await Promise.all([
  generateKeyPair("RS256", { extractable: true }),
  generateKeyPair("RS256", { extractable: true }),
]);

export function fakeKeycloak() {
  const [first, second] = KEYS as [CryptoKeyPair, CryptoKeyPair];

  const state = {
    /** Which key signs the next ID token or logout token. */
    signingKid: "key-a",
    /**
     * What the JWKS endpoint publishes, one entry per call, the last one repeating. A rotation is
     * this list disagreeing with `signingKid` for a while and then catching up.
     */
    publishedKids: ["key-a"],
    /** Merged over `sid` into every ID token, so a test names only what it is about. */
    idTokenClaims: {} as Record<string, unknown>,
    /** The session id Keycloak puts in its ID tokens and logout tokens. */
    sid: "sid-1",
    refreshToken: "refresh-1",
    accessToken: "at",
    expiresIn: 300 as number | undefined,
    /** Every request the client made, in order. */
    calls: [] as string[],
    /** Bodies posted to the token endpoint, so a test can look at what was actually sent. */
    posted: [] as URLSearchParams[],
    /** Fails every grant with this status and `invalid_grant`. */
    tokenEndpointStatus: 200,
    /** Refuses refresh grants only, as a realm does once its SSO session has gone idle. */
    refusingRefresh: false,
  };

  const keyFor = (kid: string) => (kid === "key-a" ? first : second);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  const signIdToken = async () =>
    new SignJWT({ sid: state.sid, ...state.idTokenClaims })
      .setProtectedHeader({ alg: "RS256", kid: state.signingKid })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keyFor(state.signingKid).privateKey);

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    state.calls.push(url);

    if (url.endsWith("/.well-known/openid-configuration")) {
      return json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
        token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
        jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
        end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
      });
    }

    if (url.endsWith("/protocol/openid-connect/certs")) {
      const kid =
        (state.publishedKids.length > 1 ? state.publishedKids.shift() : state.publishedKids[0]) ??
        "key-a";
      return json({
        keys: [{ ...(await exportJWK(keyFor(kid).publicKey)), kid, alg: "RS256", use: "sig" }],
      });
    }

    if (url.endsWith("/protocol/openid-connect/token")) {
      const body = new URLSearchParams(String(init?.body ?? ""));
      state.posted.push(body);
      if (state.tokenEndpointStatus !== 200) {
        return json({ error: "invalid_grant" }, state.tokenEndpointStatus);
      }
      if (body.get("grant_type") === "refresh_token" && state.refusingRefresh) {
        return json({ error: "invalid_grant", error_description: "Session not active" }, 400);
      }
      return json({
        access_token: state.accessToken,
        token_type: "Bearer",
        ...(state.expiresIn === undefined ? {} : { expires_in: state.expiresIn }),
        refresh_token: state.refreshToken,
        id_token: await signIdToken(),
      });
    }

    throw new Error(`the fake realm was asked for ${url}`);
  };

  /**
   * A logout token as Keycloak posts one to `backchannel_logout_url`: `iss`, `aud`, `iat`, `jti`,
   * the event, `sub` and `sid`. A claim given as `undefined` is left out, which is how a test
   * builds the token a check exists to refuse.
   */
  const logoutToken = async (
    claims: Record<string, unknown> = {},
    options: { readonly kid?: string } = {},
  ) => {
    const kid = options.kid ?? state.signingKid;
    const payload: Record<string, unknown> = {
      iss: ISSUER,
      aud: CLIENT_ID,
      iat: Math.floor(Date.now() / 1000),
      jti: crypto.randomUUID(),
      events: { [BACKCHANNEL_EVENT]: {} },
      sub: "u-1",
      sid: state.sid,
      ...claims,
    };
    for (const [name, value] of Object.entries(payload)) {
      if (value === undefined) delete payload[name];
    }
    return new SignJWT(payload)
      .setProtectedHeader({ alg: "RS256", kid, typ: "logout+jwt" })
      .sign(keyFor(kid).privateKey);
  };

  return { state, fetchImpl: fetchImpl as unknown as typeof globalThis.fetch, logoutToken };
}

export type Realm = ReturnType<typeof fakeKeycloak>;

/**
 * The `Cookie` header a browser would send back from a list of `Set-Cookie` values.
 *
 * A cleared cookie is dropped rather than sent back empty, because that is what a browser does —
 * and a test that sent it back would be asserting against a request no browser makes.
 */
export function asRequestHeader(cookies: readonly string[]): string {
  return cookies
    .filter((c) => !c.includes("Max-Age=0"))
    .map((c) => c.slice(0, c.indexOf(";")))
    .join("; ");
}

/** A `Map` behind the four functions a `TicketAdapter` needs, and the optional fifth. */
export function inMemoryAdapter() {
  const rows = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    rows,
    ttls,
    adapter: {
      async read(key: string) {
        return rows.get(key) ?? null;
      },
      async write(key: string, value: string, ttl: number) {
        rows.set(key, value);
        ttls.set(key, ttl);
      },
      async replace(key: string, value: string, ttl: number) {
        if (!rows.has(key)) return false;
        rows.set(key, value);
        ttls.set(key, ttl);
        return true;
      },
      async delete(key: string) {
        rows.delete(key);
      },
      async *keys(prefix: string) {
        for (const key of [...rows.keys()]) if (key.startsWith(prefix)) yield key;
      },
    },
  };
}
