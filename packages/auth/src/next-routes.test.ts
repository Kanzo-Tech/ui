// @vitest-environment node
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { bffAuth } from "./bff-auth";
import { authRoutes, type AuthRoutesConfig } from "./next-routes";

const ORIGIN = "https://app.example.test";
const ISSUER = "https://id.example.test/realms/kanzo";
const CLIENT_ID = "keasy";
const SECRET = "a-secret-nobody-chose-by-hand";

/** One pair, generated once: the tests below rebuild the realm, not the key. */
const KEY = await generateKeyPair("RS256", { extractable: true });

/**
 * A Keycloak that answers on a function instead of a socket.
 *
 * A trimmed relative of the one in `server.test.ts` — no key rotation, no error injection, because
 * those are that file's subject and not this one's. What is still real is the RS256 signature and
 * the verification `openid-client` does over it, which is what keeps these assertions about this
 * module rather than about a stub agreeing with itself.
 */
function fakeKeycloak() {
  const state = { idTokenClaims: {} as Record<string, unknown> };

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
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
      return json({ keys: [{ ...(await exportJWK(KEY.publicKey)), kid: "k", alg: "RS256", use: "sig" }] });
    }
    if (url.endsWith("/protocol/openid-connect/token")) {
      const idToken = await new SignJWT(state.idTokenClaims)
        .setProtectedHeader({ alg: "RS256", kid: "k" })
        .setIssuer(ISSUER)
        .setAudience(CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(KEY.privateKey);
      return json({
        access_token: "at",
        token_type: "Bearer",
        expires_in: 300,
        refresh_token: "refresh-1",
        id_token: idToken,
      });
    }
    throw new Error(`the fake realm was asked for ${url}`);
  };

  return { state, fetchImpl: fetchImpl as unknown as typeof globalThis.fetch };
}

type Realm = ReturnType<typeof fakeKeycloak>;

/** What a browser would send back: a cleared cookie is dropped rather than echoed empty. */
function asRequestHeader(cookies: readonly string[]): string {
  return cookies
    .filter((c) => !c.includes("Max-Age=0"))
    .map((c) => c.slice(0, c.indexOf(";")))
    .join("; ");
}

function get(
  routes: ReturnType<typeof authRoutes>,
  path: string,
  cookie?: string,
): Promise<Response> {
  return routes.GET(
    new Request(`${ORIGIN}${path}`, cookie === undefined ? {} : { headers: { cookie } }),
  );
}

describe("authRoutes", () => {
  let realm: Realm;
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

  /** Sign in the way a browser does: follow the redirect, answer as Keycloak, come back. */
  async function signIn(returnTo = "/dashboard", claims: Record<string, unknown> = { sub: "u-1" }) {
    const started = await get(routes, `/api/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
    const away = new URL(started.headers.get("location") ?? "");
    realm.state.idTokenClaims = { nonce: away.searchParams.get("nonce"), ...claims };

    const done = await get(
      routes,
      `/api/auth/callback?code=the-code&state=${away.searchParams.get("state")}`,
      asRequestHeader(started.headers.getSetCookie()),
    );
    return { started, away, done, cookie: asRequestHeader(done.headers.getSetCookie()) };
  }

  describe("signin", () => {
    it("sends the browser to the authorization endpoint and remembers the attempt", async () => {
      const response = await get(routes, "/api/auth/signin?returnTo=/dashboard");
      const away = new URL(response.headers.get("location") ?? "");

      expect(response.status).toBe(302);
      expect(away.origin + away.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
      expect(away.searchParams.get("code_challenge_method")).toBe("S256");

      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.startsWith("__Host-kanzo-auth=")).toBe(true);
    });

    it("derives the callback URL from the request it arrived on", async () => {
      const response = await get(routes, "/api/auth/signin");
      const away = new URL(response.headers.get("location") ?? "");

      expect(away.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`);
    });

    it("passes an explicit redirectUri through instead", async () => {
      const fixed = authRoutes({ ...config, redirectUri: "https://proxied.test/api/auth/callback" });
      const response = await get(fixed, "/api/auth/signin");

      expect(new URL(response.headers.get("location") ?? "").searchParams.get("redirect_uri")).toBe(
        "https://proxied.test/api/auth/callback",
      );
    });

    it("asks for one organization's scope when the query names one", async () => {
      const response = await get(routes, "/api/auth/signin?organization=acme");

      expect(new URL(response.headers.get("location") ?? "").searchParams.get("scope")).toBe(
        "openid profile email organization:acme",
      );
    });
  });

  describe("callback", () => {
    it("completes the round trip and puts the person back where they were going", async () => {
      const { done } = await signIn("/dashboard?tab=jobs");

      expect(done.status).toBe(302);
      expect(done.headers.get("location")).toBe(`${ORIGIN}/dashboard?tab=jobs`);
    });

    /**
     * The guard that `Headers.set` would have silently broken: the callback answers with the
     * session it just issued *and* the transaction it just spent, and `set` keeps only the last.
     * The symptom in production is a sign-in that appears to work and a transaction cookie that
     * outlives it — or no session at all, depending which way round the two are written.
     */
    it("emits every Set-Cookie value, not the last one", async () => {
      const { done } = await signIn();
      const cookies = done.headers.getSetCookie();

      expect(cookies).toHaveLength(2);
      expect(cookies.filter((c) => c.startsWith("__Host-kanzo-session="))).toHaveLength(1);
      // The transaction is spent: cleared, in the same answer that sets the session.
      const transaction = cookies.find((c) => c.startsWith("__Host-kanzo-auth="));
      expect(transaction).toContain("Max-Age=0");
    });

    it("refuses a callback with no transaction, as a code rather than a 500", async () => {
      const response = await get(routes, "/api/auth/callback?code=x&state=y");

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "callback.state-mismatch" });
    });

    /**
     * An open redirect, spent on a browser at the exact moment it has proved who it is. The check
     * lives on the way in — `signin` confines the query parameter before sealing it — so the
     * assertion here is over the whole flow rather than over the helper.
     */
    it("will not send a browser off-origin after signing it in", async () => {
      const { done } = await signIn("https://evil.example/steal");

      expect(done.headers.get("location")).toBe("/");
    });

    it("does accept a same-origin absolute returnTo", async () => {
      const { done } = await signIn(`${ORIGIN}/reports`);

      expect(done.headers.get("location")).toBe(`${ORIGIN}/reports`);
    });
  });

  describe("session", () => {
    it("answers with the Session the browser half expects", async () => {
      const { cookie } = await signIn("/", {
        sub: "u-1",
        preferred_username: "ada",
        realm_access: { roles: ["admin"] },
      });

      const response = await get(routes, "/api/auth/session", cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        user: { id: "u-1", username: "ada" },
        roles: ["admin"],
        organizations: [],
      });
    });

    /**
     * 401 **and no body**. `bffAuth` reads the status as "nobody is signed in" and returns `null`;
     * a body here would be a second, contradictory way to say the same thing, and the first thing
     * to parse it as a `Session` would find a user that is not there.
     */
    it("answers 401 with no body when there is no session", async () => {
      const response = await get(routes, "/api/auth/session");

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("");
      expect(response.body).toBeNull();
      expect(response.headers.get("content-type")).toBeNull();
    });

    it("answers 401 for a cookie it cannot open", async () => {
      const response = await get(routes, "/api/auth/session", "__Host-kanzo-session=forged");

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("");
    });

    it("is never cached, signed in or not", async () => {
      const { cookie } = await signIn();

      expect((await get(routes, "/api/auth/session", cookie)).headers.get("cache-control")).toBe(
        "no-store",
      );
      expect((await get(routes, "/api/auth/session")).headers.get("cache-control")).toBe("no-store");
    });
  });

  describe("signout", () => {
    it("ends the session at Keycloak and clears the cookie", async () => {
      const { cookie } = await signIn();

      const response = await get(routes, "/api/auth/signout?returnTo=/bye", cookie);
      const away = new URL(response.headers.get("location") ?? "");

      expect(away.origin + away.pathname).toBe(`${ISSUER}/protocol/openid-connect/logout`);
      expect(away.searchParams.get("post_logout_redirect_uri")).toBe(`${ORIGIN}/bye`);
      // Without the hint Keycloak asks the person to confirm who is leaving, which reads as a bug.
      expect(away.searchParams.get("id_token_hint")).toBeTruthy();

      const cleared = response.headers.getSetCookie();
      expect(cleared).toHaveLength(1);
      expect(cleared[0]).toContain("__Host-kanzo-session=");
      expect(cleared[0]).toContain("Max-Age=0");
    });

    it("will not hand an off-origin post-logout URL to the IdP", async () => {
      const response = await get(routes, "/api/auth/signout?returnTo=https://evil.example/");

      expect(
        new URL(response.headers.get("location") ?? "").searchParams.get("post_logout_redirect_uri"),
      ).toBeNull();
    });

    it("signs out a browser that was not signed in, without failing", async () => {
      const response = await get(routes, "/api/auth/signout");

      expect(response.status).toBe(302);
    });
  });

  it("answers 404 for a path this door does not serve", async () => {
    expect((await get(routes, "/api/auth/token")).status).toBe(404);
  });

  it("serves POST through the same table as GET", async () => {
    const response = await routes.POST(new Request(`${ORIGIN}/api/auth/session`));

    expect(response.status).toBe(401);
  });

  /**
   * The two halves, joined. Everything above asserts what these handlers emit; this asserts that
   * the browser half agrees — the paths it navigates to, and its reading of 401. Two descriptions
   * of one contract is how they drift, so the contract is exercised instead.
   */
  describe("against bffAuth, the other end of the contract", () => {
    const through = (routes: ReturnType<typeof authRoutes>, cookie: string) =>
      ((input: RequestInfo | URL, init?: RequestInit) =>
        routes.GET(
          new Request(new URL(String(input), ORIGIN), { ...init, headers: { cookie } }),
        )) as unknown as typeof globalThis.fetch;

    it("reads the session endpoint into a Session", async () => {
      const { cookie } = await signIn("/", { sub: "u-1", email: "ada@example.test" });
      const auth = bffAuth({ fetch: through(routes, cookie), navigate: () => {} });

      expect(await auth.getSession()).toMatchObject({ user: { id: "u-1", email: "ada@example.test" } });
    });

    it("reads a 401 as nobody being signed in", async () => {
      const auth = bffAuth({ fetch: through(routes, ""), navigate: () => {} });

      expect(await auth.getSession()).toBeNull();
    });

    it("navigates to paths these handlers serve", async () => {
      const visited: string[] = [];
      const auth = bffAuth({ fetch: through(routes, ""), navigate: (url) => visited.push(url) });

      await auth.signIn({ returnTo: "/dashboard", organization: "acme" });
      await auth.signOut({ returnTo: "/bye" });

      expect(visited).toHaveLength(2);
      for (const url of visited) {
        expect((await get(routes, url)).status).toBe(302);
      }
    });
  });
});
