// @vitest-environment node
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { cookieValue } from "./cookie-session";

// A server component has no `Request`: `next/headers` is how it reaches the one it renders for,
// and `redirect` is how it leaves. Both are the framework's, and both are what a unit test stands in.
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));

/** What a server component would be handed for this request: its cookies, and the proxy's headers. */
function rendering(cookie: string, incoming: Record<string, string>): void {
  vi.mocked(cookies).mockImplementation(
    async () =>
      ({
        toString: () => cookie,
        get: (name: string) => {
          const value = cookieValue(cookie, name);
          return value === undefined ? undefined : { name, value };
        },
      }) as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  vi.mocked(headers).mockImplementation(
    async () => new Headers(incoming) as unknown as Awaited<ReturnType<typeof headers>>,
  );
}

/** The request headers a proxy response hands the page behind it, by Next's own encoding. */
function forwarded(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

function navigation(path: string, cookie?: string, extra: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: { "sec-fetch-mode": "navigate", ...(cookie === undefined ? {} : { cookie }), ...extra },
  });
}

describe("kanzoAuth", () => {
  let realm: Realm;
  let backing: ReturnType<typeof inMemoryAdapter>;
  let config: KanzoAuthConfig;
  let auth: KanzoAuth;

  beforeEach(() => {
    vi.mocked(cookies).mockReset();
    vi.mocked(headers).mockReset();
    vi.mocked(redirect).mockClear();
    realm = fakeKeycloak();
    backing = inMemoryAdapter();
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: SECRET,
      fetch: realm.fetchImpl,
      store: ticketStore(backing.adapter),
      public: ["/health"],
    };
    auth = kanzoAuth(config);
  });

  async function signIn(claims: Record<string, unknown> = { sub: "u-1" }): Promise<string> {
    const started = await auth.routes.GET(new Request(`${ORIGIN}/api/auth/signin`));
    const away = new URL(started.headers.get("location") ?? "");
    realm.state.idTokenClaims = { nonce: away.searchParams.get("nonce"), ...claims };
    const done = await auth.routes.GET(
      new Request(`${ORIGIN}/api/auth/callback?code=c&state=${away.searchParams.get("state")}`, {
        headers: { cookie: asRequestHeader(started.headers.getSetCookie()) },
      }),
    );
    return asRequestHeader(done.headers.getSetCookie());
  }

  describe("binding", () => {
    /**
     * `next build` imports every route module with no secrets in the environment, so the config
     * is read on the first request. A deployment that started before its vault answered must
     * recover on the next request rather than remember the failure for the life of the process.
     */
    it("reads the config on first use, and remembers it only once it worked", async () => {
      const thunk = vi
        .fn<() => Promise<KanzoAuthConfig>>()
        .mockRejectedValueOnce(new Error("the vault is not up yet"))
        .mockResolvedValue(config);
      const late = kanzoAuth(thunk);

      expect(thunk).not.toHaveBeenCalled();
      expect(Object.keys(late.routes)).toEqual(["GET", "POST"]);

      await expect(late.routes.GET(new Request(`${ORIGIN}/api/auth/signin`))).rejects.toThrow(/vault/);
      expect((await late.routes.GET(new Request(`${ORIGIN}/api/auth/signin`))).status).toBe(302);
      await late.routes.GET(new Request(`${ORIGIN}/api/auth/signin`));

      expect(thunk).toHaveBeenCalledTimes(2);
    });

    it("discovers once for the proxy, the routes and the forwarder together", async () => {
      const cookie = await signIn();
      await auth.proxy(navigation("/graphs", cookie));
      await auth.routes.GET(new Request(`${ORIGIN}/api/auth/session`, { headers: { cookie } }));

      expect(realm.state.calls.filter((c) => c.endsWith("openid-configuration"))).toHaveLength(1);
    });
  });

  describe("proxy", () => {
    it("lets a live session through without renewing it", async () => {
      const cookie = await signIn();

      const response = await auth.proxy(navigation("/graphs", cookie));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(realm.state.posted.filter((p) => p.get("grant_type") === "refresh_token")).toHaveLength(0);
    });

    it("sends a navigation with no session to sign in, carrying the path and the query", async () => {
      const response = await auth.proxy(navigation("/graphs/7?tab=rules"));

      expect(response.status).toBe(307);
      const away = new URL(response.headers.get("location") ?? "");
      expect(away.pathname).toBe("/api/auth/signin");
      expect(away.searchParams.get("returnTo")).toBe("/graphs/7?tab=rules");
    });

    it("sends a sign-in to the host the browser addressed, not the one the server listens on", async () => {
      const response = await auth.proxy(
        new NextRequest("http://localhost:3000/graphs", {
          headers: { host: "acme.localhost:3000", "sec-fetch-mode": "navigate" },
        }),
      );

      expect(new URL(response.headers.get("location") ?? "").origin).toBe("http://acme.localhost:3000");
    });

    it("treats a request without Fetch Metadata as a navigation", async () => {
      const response = await auth.proxy(new NextRequest(`${ORIGIN}/graphs`));

      expect(response.status).toBe(307);
    });

    /**
     * A prefetch, a server action and an RSC fetch are `cors`/`no-cors`/`same-origin` requests
     * that cannot follow a sign-in, and a hover that started one would be a sign-in nobody asked
     * for. The Next router answers its own fetch's 401 with a hard navigation, which then arrives
     * here as `navigate`.
     */
    it("answers anything that is not a navigation with a bare 401", async () => {
      for (const mode of ["cors", "no-cors", "same-origin"]) {
        const response = await auth.proxy(
          new NextRequest(`${ORIGIN}/graphs`, { headers: { "sec-fetch-mode": mode } }),
        );

        expect(response.status).toBe(401);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("location")).toBeNull();
        expect(await response.text()).toBe("");
      }
    });

    it("ends a session the IdP refused to renew: the ticket dropped, the cookie cleared, a sign-in", async () => {
      realm.state.expiresIn = 30;
      const cookie = await signIn();
      realm.state.refusingRefresh = true;

      const response = await auth.proxy(navigation("/graphs/7", cookie));

      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location") ?? "").searchParams.get("returnTo")).toBe("/graphs/7");
      expect(response.headers.getSetCookie()[0]).toContain("Max-Age=0");
      expect(backing.rows.size).toBe(0);
    });

    it("renews in place under a ticket store, leaving the cookie alone", async () => {
      realm.state.expiresIn = 30;
      const cookie = await signIn();
      const before = [...backing.rows.values()];

      const response = await auth.proxy(navigation("/graphs", cookie));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(response.headers.get("x-middleware-set-cookie")).toBeNull();
      expect([...backing.rows.values()]).not.toEqual(before);
      expect(backing.rows.size).toBe(1);
    });

    /**
     * The stateless store re-seals, and the page rendering behind this proxy must read the new
     * cookie rather than the one the browser sent. `response.cookies.set` is the call Next merges
     * into the same request's `cookies()` — it writes `x-middleware-set-cookie` — where a raw
     * `Set-Cookie` header would only reach the browser.
     */
    it("hands a re-sealed stateless cookie to this request's cookies(), not only to the browser", async () => {
      const stateless = kanzoAuth({ ...config, store: undefined });
      auth = stateless;
      realm.state.expiresIn = 30;
      const cookie = await signIn();

      const response = await stateless.proxy(navigation("/graphs", cookie));

      const merged = response.headers.get("x-middleware-set-cookie") ?? "";
      expect(merged).toContain("__Host-kanzo-session=");
      expect(merged).not.toContain(cookie.slice(cookie.indexOf("=") + 1));
      expect(response.headers.getSetCookie()[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
    });

    it("replaces every incoming x-kanzo-* header, and forwards the URL and the product's own", async () => {
      const cookie = await signIn();

      const response = await auth.proxy(
        new NextRequest(`${ORIGIN}/graphs?tab=x`, {
          headers: {
            cookie,
            "sec-fetch-mode": "navigate",
            "x-kanzo-url": "https://evil.test/elsewhere",
            "x-kanzo-anything": "forged",
          },
        }),
        { headers: { "x-nonce": "n-1" } },
      );

      expect(forwarded(response, "x-kanzo-url")).toBe(`${ORIGIN}/graphs?tab=x`);
      expect(forwarded(response, "x-kanzo-anything")).toBeNull();
      expect(forwarded(response, "x-nonce")).toBe("n-1");
    });

    it("lets static files, the auth routes, the problem page, the api mount and public paths through unread", async () => {
      const mounted = kanzoAuth({
        ...config,
        api: { mount: "/api/data", target: "https://reports.internal" },
      });
      for (const path of [
        "/fossil/fossil_wasm_bg.wasm",
        "/api/auth/signin",
        "/auth/problem",
        "/api/data/reports",
        "/health/live",
      ]) {
        const response = await mounted.proxy(navigation(path));
        expect(response.headers.get("x-middleware-next"), path).toBe("1");
      }
      // A public prefix opens its segment, not every path that starts with its letters.
      expect((await mounted.proxy(navigation("/healthcare"))).status).toBe(307);
    });

    it("sends a navigation to the problem page when the store does not answer", async () => {
      const cookie = await signIn();
      backing.adapter.read = async () => {
        throw new Error("ECONNREFUSED");
      };

      const response = await auth.proxy(navigation("/graphs", cookie));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`${ORIGIN}/auth/problem?code=session%2Funavailable`);
    });

    it("passes through when the IdP cannot be reached to renew, because nothing was refused", async () => {
      realm.state.expiresIn = 30;
      const cookie = await signIn();
      realm.state.tokenEndpointStatus = 502;

      const response = await auth.proxy(navigation("/graphs", cookie));

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(backing.rows.size).toBe(1);
    });
  });

  describe("session", () => {
    it("reads the session the request carries, with the tenant the resolver names", async () => {
      auth = kanzoAuth({
        ...config,
        organization: ({ url, cookies: jar }) => jar.get("tenant")?.value ?? url.hostname.split(".")[0],
      });
      const cookie = await signIn({
        sub: "u-1",
        organization: { app: { resource_access: { board: { roles: ["editor"] } } } },
      });
      rendering(cookie, { host: "app.example.test", "x-kanzo-url": `${ORIGIN}/graphs` });

      const session = await auth.session();

      expect(session?.user.id).toBe("u-1");
      expect(session?.organization).toBe("app");
    });

    it("answers null with no session, and redirects to sign in back to the page when required", async () => {
      rendering("", { host: "app.example.test", "x-kanzo-url": `${ORIGIN}/graphs/7?tab=x` });

      await expect(auth.session()).resolves.toBeNull();
      await expect(auth.session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/api/auth/signin?returnTo=%2Fgraphs%2F7%3Ftab%3Dx");
    });

    it("signs in back to the root on a page the proxy did not run on", async () => {
      rendering("", { host: "app.example.test" });

      await expect(auth.session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/api/auth/signin?returnTo=%2F");
    });
  });

  /**
   * ui#33, end to end over the fake realm: a deep link, an access token that expired while the
   * person was away, and then the realm's SSO session going idle. The proxy renews the first time
   * and the page renders with the same cookie; the second time it ends the session and the sign-in
   * comes back to the link.
   */
  it("renews behind a page, and when the realm has let the session go, returns to the deep link", async () => {
    auth = kanzoAuth({ ...config, organization: () => "app" });
    realm.state.expiresIn = 30;
    realm.state.accessToken = "first";
    const cookie = await signIn({ sub: "u-1" });

    realm.state.accessToken = "renewed";
    realm.state.expiresIn = 3600;
    const through = await auth.proxy(navigation("/graphs/7?tab=rules", cookie));
    expect(through.headers.get("x-middleware-next")).toBe("1");
    expect(through.headers.getSetCookie()).toEqual([]);

    rendering(cookie, { host: "app.example.test", "x-kanzo-url": forwarded(through, "x-kanzo-url") ?? "" });
    const page = await auth.session({ required: true });
    expect(page.organization).toBe("app");
    expect(page.expiresAt).toBeGreaterThan(Date.now() + 3_000_000);

    const [ticket = ""] = backing.rows.keys();
    const row = JSON.parse(backing.rows.get(ticket) ?? "{}") as { accessTokenExpiresAt: number };
    backing.rows.set(ticket, JSON.stringify({ ...row, accessTokenExpiresAt: Date.now() }));
    realm.state.refusingRefresh = true;

    const ended = await auth.proxy(navigation("/graphs/7?tab=rules", cookie));
    expect(ended.status).toBe(307);
    expect(new URL(ended.headers.get("location") ?? "").searchParams.get("returnTo")).toBe(
      "/graphs/7?tab=rules",
    );
    rendering(cookie, { host: "app.example.test" });
    await expect(auth.session()).resolves.toBeNull();
  });
});
