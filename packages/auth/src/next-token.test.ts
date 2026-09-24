// @vitest-environment node
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { authToken } from "./next-token";
import { authRoutes, type AuthRoutesConfig } from "./next-routes";

const ORIGIN = "https://app.example.test";
const ISSUER = "https://id.example.test/realms/kanzo";
const CLIENT_ID = "keasy";
const SECRET = "a-secret-nobody-chose-by-hand";

const KEY = await generateKeyPair("RS256", { extractable: true });

/**
 * The trimmed fake realm of `next-routes.test.ts`, with the two fields this file varies: what the
 * token endpoint hands back as the access token, and how long it says it lives.
 */
function fakeKeycloak() {
  const state = {
    idTokenClaims: {} as Record<string, unknown>,
    accessToken: "at-1",
    expiresIn: 3600,
    refreshToken: "refresh-1",
    posted: [] as URLSearchParams[],
  };

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);

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
      return json({
        keys: [{ ...(await exportJWK(KEY.publicKey)), kid: "k", alg: "RS256", use: "sig" }],
      });
    }
    if (url.endsWith("/protocol/openid-connect/token")) {
      state.posted.push(new URLSearchParams(String(init?.body ?? "")));
      const idToken = await new SignJWT(state.idTokenClaims)
        .setProtectedHeader({ alg: "RS256", kid: "k" })
        .setIssuer(ISSUER)
        .setAudience(CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(KEY.privateKey);
      return json({
        access_token: state.accessToken,
        token_type: "Bearer",
        expires_in: state.expiresIn,
        refresh_token: state.refreshToken,
        id_token: idToken,
      });
    }
    throw new Error(`the fake realm was asked for ${url}`);
  };

  return { state, fetchImpl: fetchImpl as unknown as typeof globalThis.fetch };
}

function asRequestHeader(cookies: readonly string[]): string {
  return cookies
    .filter((c) => !c.includes("Max-Age=0"))
    .map((c) => c.slice(0, c.indexOf(";")))
    .join("; ");
}

describe("authToken", () => {
  let realm: ReturnType<typeof fakeKeycloak>;
  let config: AuthRoutesConfig;
  let routes: ReturnType<typeof authRoutes>;

  beforeEach(() => {
    realm = fakeKeycloak();
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: SECRET,
      fetch: realm.fetchImpl,
    };
    routes = authRoutes(config);
  });

  /** Sign in through the real routes, so the cookie under test is the one a browser would hold. */
  async function signIn(): Promise<string> {
    const started = await routes.GET(new Request(`${ORIGIN}/api/auth/signin`));
    const away = new URL(started.headers.get("location") ?? "");
    realm.state.idTokenClaims = { nonce: away.searchParams.get("nonce"), sub: "u-1" };

    const done = await routes.GET(
      new Request(`${ORIGIN}/api/auth/callback?code=c&state=${away.searchParams.get("state")}`, {
        headers: { cookie: asRequestHeader(started.headers.getSetCookie()) },
      }),
    );
    return asRequestHeader(done.headers.getSetCookie());
  }

  /**
   * What the host was doing without this: rebuilding the sealed cookie by hand — same name, same
   * `maxAge`, same secret — to open it and take the token out. That is this package's protocol
   * reimplemented in a product, held together by two constants agreeing, and it breaks in silence
   * the day either default moves.
   */
  it("answers the access token a route handler should forward", async () => {
    realm.state.accessToken = "the-bearer-token";
    const cookie = await signIn();

    const held = await authToken(config)(cookie);

    expect(held?.accessToken).toBe("the-bearer-token");
    expect(held?.session.user.id).toBe("u-1");
    expect(held?.cookies).toEqual([]);
  });

  it("answers null with no cookie, and with one it did not seal", async () => {
    const get = authToken(config);

    await expect(get(null)).resolves.toBeNull();
    await expect(get(undefined)).resolves.toBeNull();
    await expect(get("__Host-kanzo-session=forged")).resolves.toBeNull();
  });

  it("renews inside the window and hands back the cookie to set", async () => {
    realm.state.expiresIn = 20;
    const cookie = await signIn();

    realm.state.accessToken = "renewed";
    const held = await authToken(config)(cookie);

    expect(held?.accessToken).toBe("renewed");
    expect(held?.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
  });

  it("takes a window of its own", async () => {
    const cookie = await signIn();

    await authToken(config)(cookie, { renewWithin: 7200 });

    expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");
  });

  /**
   * The signature is the design. A React Server Component cannot write cookies in Next, and a
   * renewal whose `Set-Cookie` is dropped does not go stale — under rotation the token it spent is
   * gone and the one it minted was never kept, so the session is over. A zero-argument form
   * reading `next/headers` would work in an RSC exactly well enough to destroy the session on the
   * first renewal, so there is no zero-argument form: the caller must have a `Cookie` header,
   * which is to say must be somewhere that can answer with a `Set-Cookie`.
   */
  it("has no zero-argument form, which is what keeps it out of a server component", async () => {
    const get = authToken(config);

    // @ts-expect-error — the absence, as a type error rather than as a sentence in a doc.
    await expect(get()).resolves.toBeNull();
  });
});
