// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { bffAuth } from "./bff-auth";
import { kanzoAuth, type KanzoAuth, type KanzoAuthConfig } from "./next-auth";
import { ticketStore } from "./store";
import {
  CLIENT_ID,
  ISSUER,
  ORIGIN,
  SECRET,
  asRequestHeader,
  fakeKeycloak,
  inMemoryAdapter,
  type Realm,
} from "./test/fake-keycloak";
import { AuthError } from "./types";

type Routes = KanzoAuth["routes"];

/** The routes of a `kanzoAuth` over `config`: the door a route file actually exports. */
function authRoutes(config: KanzoAuthConfig): Routes {
  return kanzoAuth(config).routes;
}

function get(
  routes: Routes,
  path: string,
  cookie?: string,
): Promise<Response> {
  return routes.GET(
    new Request(`${ORIGIN}${path}`, cookie === undefined ? {} : { headers: { cookie } }),
  );
}

/** A request with a verb and headers of its own, for the routes that care about either. */
function send(
  routes: Routes,
  method: "GET" | "POST",
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return routes[method](new Request(`${ORIGIN}${path}`, { method, headers }));
}

describe("authRoutes", () => {
  let realm: Realm;
  let config: KanzoAuthConfig;
  let routes: Routes;

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
      expect(cookies[0]?.startsWith(`__Host-kanzo-auth.${away.searchParams.get("state")}=`)).toBe(true);
    });

    it("derives the callback URL from the request it arrived on", async () => {
      const response = await get(routes, "/api/auth/signin");
      const away = new URL(response.headers.get("location") ?? "");

      expect(away.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/callback`);
    });

    /**
     * Next builds `request.url` from the address it listens on: under `next dev` a request for
     * `acme.localhost:3000` arrives as `http://localhost:3000/…`, and only `Host` says which
     * organization's origin the browser is on. A callback on the listening address is one the IdP
     * has not registered.
     */
    it("derives it from the host the browser addressed, not the one the server listens on", async () => {
      const response = await routes.GET(
        new Request("http://localhost:3000/api/auth/signin", { headers: { host: "acme.localhost:3000" } }),
      );
      const away = new URL(response.headers.get("location") ?? "");

      expect(away.searchParams.get("redirect_uri")).toBe("http://acme.localhost:3000/api/auth/callback");
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

    /**
     * `?organization=acme%20offline_access` is a query parameter composed by whoever made the
     * link, and `scope` is a space-delimited list — so an unchecked space is not a strange alias,
     * it is a second scope. `offline_access` in particular asks for a refresh token that outlives
     * the browser session. The refusal is `begin`'s; what this asserts is that it arrives as a
     * code rather than as a 500 on a mistyped link.
     */
    it("refuses an organization that would inject a scope, on the problem page rather than a 500", async () => {
      const response = await get(
        routes,
        `/api/auth/signin?organization=${encodeURIComponent("acme offline_access")}`,
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/auth/problem?code=organization%2Finvalid`);
    });

    it("sends the browser to the problem page when the IdP cannot be reached", async () => {
      const down = authRoutes({
        ...config,
        fetch: (async () => {
          throw new TypeError("fetch failed");
        }) as unknown as typeof globalThis.fetch,
      });

      const response = await get(down, "/api/auth/signin");

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/auth/problem?code=idp%2Funreachable`);
    });

    it("lets a cross-site link start a sign-in, because that is what a sign-in link is", async () => {
      // Starting a flow grants nothing — `state`, `nonce` and PKCE bind the rest of it — and a
      // product may legitimately be linked to from anywhere with "sign in to X".
      const response = await send(routes, "GET", "/api/auth/signin", {
        "sec-fetch-site": "cross-site",
      });

      expect(response.status).toBe(302);
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
      const transaction = cookies.find((c) => c.startsWith("__Host-kanzo-auth."));
      expect(transaction).toContain("Max-Age=0");
    });

    it("sends a callback with no transaction to the problem page, with its code", async () => {
      const response = await get(routes, "/api/auth/callback?code=x&state=y");

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        `${ORIGIN}/auth/problem?code=callback%2Fstate-mismatch`,
      );
      expect(response.body).toBeNull();
    });

    it("sends a callback whose state is not this browser's to the product's own problem page", async () => {
      const own = authRoutes({ ...config, problemPage: "/sign-in/failed" });
      const started = await get(own, "/api/auth/signin");

      const response = await get(
        own,
        "/api/auth/callback?code=the-code&state=someone-elses",
        asRequestHeader(started.headers.getSetCookie()),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        `${ORIGIN}/sign-in/failed?code=callback%2Fstate-mismatch`,
      );
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

    it("answers the current tenant, as the resolver reads it off this request", async () => {
      routes = authRoutes({
        ...config,
        organization: ({ url, headers, cookies }) =>
          `${url.hostname.split(".")[0]}-${headers.get("x-region")}-${cookies.get("pick")?.value}`,
      });
      const { cookie } = await signIn("/", {
        sub: "u-1",
        organization: { "app-eu-acme": { resource_access: { board: { roles: ["editor"] } } } },
      });

      const response = await routes.GET(
        new Request(`${ORIGIN}/api/auth/session`, {
          headers: { cookie: `${cookie}; pick=acme`, "x-region": "eu" },
        }),
      );

      expect(await response.json()).toMatchObject({ organization: "app-eu-acme" });
    });

    it("reads the tenant off the host the browser addressed", async () => {
      routes = authRoutes({ ...config, organization: ({ url }) => url.hostname.split(".")[0] });
      const { cookie } = await signIn("/", {
        sub: "u-1",
        organization: { acme: { resource_access: { board: { roles: ["editor"] } } } },
      });

      const response = await routes.GET(
        new Request("http://localhost:3000/api/auth/session", {
          headers: { cookie, host: "acme.localhost:3000" },
        }),
      );

      expect(await response.json()).toMatchObject({ organization: "acme" });
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

    it("answers 503 with a code, not a bare 500, when the session store does not answer", async () => {
      let up = true;
      const rows = new Map<string, string>();
      const flaky = authRoutes({
        ...config,
        store: ticketStore({
          read: async (key) => {
            if (!up) throw new Error("ECONNREFUSED");
            return rows.get(key) ?? null;
          },
          write: async (key, value) => void rows.set(key, value),
          replace: async (key, value) => rows.has(key) && Boolean(rows.set(key, value)),
          delete: async (key) => void rows.delete(key),
        }),
      });
      routes = flaky;
      const { cookie } = await signIn();
      up = false;

      const response = await get(flaky, "/api/auth/session", cookie);

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: "session/unavailable" });
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

    it("sends a sign-out the IdP cannot answer to the problem page, rather than a bare 500", async () => {
      const down = authRoutes({
        ...config,
        fetch: (async () => {
          throw new TypeError("fetch failed");
        }) as unknown as typeof globalThis.fetch,
      });

      const response = await get(down, "/api/auth/signout");

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/auth/problem?code=idp%2Funreachable`);
    });

    it("signs out a browser that was not signed in, without failing", async () => {
      const response = await get(routes, "/api/auth/signout");

      expect(response.status).toBe(302);
    });

    /**
     * The cost of `SameSite=Lax`, which this package chose on a consumer's behalf and therefore
     * owes the compensation for: a cross-site *top-level navigation* still carries the cookie, so
     * `<img src="…/api/auth/signout">` on any page anywhere is a logout anyone can cause.
     */
    it("refuses a cross-site logout", async () => {
      const { cookie } = await signIn();
      const response = await routes.GET(
        new Request(`${ORIGIN}/api/auth/signout`, {
          headers: { cookie, "sec-fetch-site": "cross-site" },
        }),
      );

      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe("refresh", () => {
    /**
     * The route that was missing, and the one the whole package was already built for:
     * `relyingParty.refresh` rotates the token and `single-flight.ts` was written for the burst,
     * and nothing called either. A token of an hour behind a cookie of eight hours meant seven
     * hours in which the application drew and every request for data was a 401.
     */
    it("renews the session and reissues the cookie", async () => {
      const { cookie } = await signIn();

      const response = await routes.POST(
        new Request(`${ORIGIN}/api/auth/refresh`, { method: "POST", headers: { cookie } }),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ user: { id: "u-1" } });
      const reissued = response.headers.getSetCookie();
      expect(reissued).toHaveLength(1);
      expect(reissued[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("answers 401 when there is nothing to renew", async () => {
      const response = await send(routes, "POST", "/api/auth/refresh");

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: "session/absent" });
    });

    it("answers 401 and clears the cookie when the IdP refuses to renew", async () => {
      const { cookie } = await signIn();
      realm.state.refusingRefresh = true;

      const response = await routes.POST(
        new Request(`${ORIGIN}/api/auth/refresh`, { method: "POST", headers: { cookie } }),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: "token/refused" });
      expect(response.headers.getSetCookie()[0]).toContain("Max-Age=0");
    });

    /**
     * The only route here that constrains its verb. The others are reached by navigation, where
     * the verb is the browser's to choose; this one *spends* a refresh token, and a `GET` that
     * spends something is one prefetch, one link preview or one crawler away from spending it.
     */
    it("answers 405 to a GET, because it spends something", async () => {
      const { cookie } = await signIn();
      const response = await get(routes, "/api/auth/refresh", cookie);

      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("POST");
    });

    it("refuses a cross-site renewal", async () => {
      const { cookie } = await signIn();
      const response = await routes.POST(
        new Request(`${ORIGIN}/api/auth/refresh`, {
          method: "POST",
          headers: { cookie, "sec-fetch-site": "cross-site" },
        }),
      );

      expect(response.status).toBe(403);
    });
  });

  it("refuses a cross-site read of who is signed in", async () => {
    const { cookie } = await signIn();
    const response = await routes.GET(
      new Request(`${ORIGIN}/api/auth/session`, {
        headers: { cookie, "sec-fetch-site": "cross-site" },
      }),
    );

    expect(response.status).toBe(403);
  });

  /**
   * The callback *is* a cross-site top-level navigation — it is the identity provider sending the
   * browser back — so the check that covers the other routes must not cover this one. Asserted
   * because a later tidy-up that applied the guard uniformly would break every sign-in, and would
   * break it only against a real IdP.
   */
  it("still accepts the callback, which arrives cross-site by definition", async () => {
    const started = await get(routes, "/api/auth/signin?returnTo=/dashboard");
    const away = new URL(started.headers.get("location") ?? "");
    realm.state.idTokenClaims = { nonce: away.searchParams.get("nonce"), sub: "u-1" };

    const done = await routes.GET(
      new Request(`${ORIGIN}/api/auth/callback?code=c&state=${away.searchParams.get("state")}`, {
        headers: {
          cookie: asRequestHeader(started.headers.getSetCookie()),
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
        },
      }),
    );

    expect(done.status).toBe(302);
    expect(done.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
  });

  describe("backchannel-logout", () => {
    function logout(token: string | null, headers: Record<string, string> = {}): Promise<Response> {
      return routes.POST(
        new Request(`${ORIGIN}/api/auth/backchannel-logout`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
          body: token === null ? "" : new URLSearchParams({ logout_token: token }).toString(),
        }),
      );
    }

    beforeEach(() => {
      routes = authRoutes({ ...config, store: ticketStore(inMemoryAdapter().adapter) });
    });

    it("ends the session Keycloak names, and answers 200", async () => {
      const { cookie } = await signIn();

      const response = await logout(await realm.logoutToken());

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect((await get(routes, "/api/auth/session", cookie)).status).toBe(401);
    });

    it("answers 400 for a token that does not verify, or for none", async () => {
      await signIn();

      expect((await logout(await realm.logoutToken({ aud: "other" }))).status).toBe(400);
      expect((await logout(null)).status).toBe(400);
    });

    it("answers 501 when the store cannot end a session from the server", async () => {
      const stateless = authRoutes(config);

      const response = await stateless.POST(
        new Request(`${ORIGIN}/api/auth/backchannel-logout`, {
          method: "POST",
          body: new URLSearchParams({ logout_token: await realm.logoutToken() }),
        }),
      );

      expect(response.status).toBe(501);
      expect(await response.json()).toMatchObject({ error: "session/irrevocable" });
    });

    /**
     * Keycloak's POST carries no browser's Fetch Metadata, and the signature on the token is what
     * authenticates it — so the same-site check, which exists to stop a *page* causing a request,
     * has nothing to say here and must not refuse it if a proxy adds an `Origin`.
     */
    it("is not subject to the same-site check", async () => {
      await signIn();

      const response = await logout(await realm.logoutToken(), { origin: "http://keycloak:8080" });

      expect(response.status).toBe(200);
    });

    it("answers 405 to anything but a POST", async () => {
      expect((await get(routes, "/api/auth/backchannel-logout")).status).toBe(405);
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
    const through = (routes: Routes, cookie: string) =>
      ((input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(new URL(String(input), ORIGIN), { ...init, headers: { cookie } });
        return request.method === "POST" ? routes.POST(request) : routes.GET(request);
      }) as unknown as typeof globalThis.fetch;

    it("reads the session endpoint into a Session", async () => {
      const { cookie } = await signIn("/", { sub: "u-1", email: "ada@example.test" });
      const auth = bffAuth({ fetch: through(routes, cookie), navigate: () => {} });

      expect(await auth.getSession()).toMatchObject({ user: { id: "u-1", email: "ada@example.test" } });
    });

    it("reads a 401 as nobody being signed in", async () => {
      const auth = bffAuth({ fetch: through(routes, ""), navigate: () => {} });

      expect(await auth.getSession()).toBeNull();
    });

    it("reads a store that does not answer as a failure, not as nobody being signed in", async () => {
      let up = true;
      const rows = new Map<string, string>();
      routes = authRoutes({
        ...config,
        store: ticketStore({
          read: async (key) => {
            if (!up) throw new Error("ECONNREFUSED");
            return rows.get(key) ?? null;
          },
          write: async (key, value) => void rows.set(key, value),
          replace: async (key, value) => rows.has(key) && Boolean(rows.set(key, value)),
          delete: async (key) => void rows.delete(key),
        }),
      });
      const { cookie } = await signIn();
      up = false;
      const auth = bffAuth({ fetch: through(routes, cookie), navigate: () => {} });

      const failed = await auth.getSession().catch((error: unknown) => error);

      expect(failed).toBeInstanceOf(AuthError);
      expect(failed).toMatchObject({ code: "session/unavailable", data: { status: 503 } });
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

    /**
     * The whole renewal, end to end, with a real `bffAuth` in front of these real handlers: a
     * request for data answers 401 because the access token behind the cookie has expired, the
     * browser half posts to the refresh route these handlers serve, and the request goes again.
     * Two descriptions of that contract is how it drifts, so it is exercised instead.
     */
    it("recovers a 401 for data by renewing through the refresh route", async () => {
      const { cookie } = await signIn();
      const asked: string[] = [];

      const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        asked.push(url);
        if (url.startsWith("/api/auth")) {
          const request = new Request(new URL(url, ORIGIN), { ...init, headers: { cookie } });
          return request.method === "POST" ? routes.POST(request) : routes.GET(request);
        }
        // The resource server: a 401 first, and an answer once the token behind the cookie is new.
        const renewed = asked.includes("/api/auth/refresh");
        return Promise.resolve(new Response(renewed ? "the jobs" : "", { status: renewed ? 200 : 401 }));
      }) as unknown as typeof globalThis.fetch;

      const auth = bffAuth({ fetch: fetchImpl, navigate: () => {} });
      await auth.getSession();

      const response = await auth.fetch("/v1/jobs");

      expect(response.status).toBe(200);
      expect(asked).toContain("/api/auth/refresh");
    });
  });
});
