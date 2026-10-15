// @vitest-environment node
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kanzoAuth, type KanzoAuth, type KanzoAuthConfig } from "./next-auth";
import { CLIENT_ID, ISSUER, JWKS, localRealm, type Realm } from "./test/realm";

// A server component has no `Request`: `next/headers` is how it reaches the one it renders for,
// and `redirect` is how it leaves. Both are the framework's, and both are what a unit test stands in.
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
}));

const ORIGIN = "https://app.example.test";

/** What a server component would be handed for this request: its cookies, and its headers. */
function rendering(incoming: Record<string, string>, jar: Record<string, string> = {}): void {
  vi.mocked(cookies).mockImplementation(
    async () =>
      ({
        get: (name: string) => (name in jar ? { name, value: jar[name] } : undefined),
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

function navigation(path: string, extra: Record<string, string> = {}): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, { headers: { "sec-fetch-mode": "navigate", ...extra } });
}

describe("kanzoAuth", () => {
  let realm: Realm;
  let config: KanzoAuthConfig;
  let auth: KanzoAuth;

  beforeEach(async () => {
    vi.mocked(cookies).mockReset();
    vi.mocked(headers).mockReset();
    vi.mocked(redirect).mockClear();
    realm = await localRealm();
    vi.stubGlobal("fetch", realm.fetch());
    config = { issuer: ISSUER, clientId: CLIENT_ID, jwks: JWKS };
    auth = kanzoAuth(config);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * `next build` imports every module with no configuration in the environment, so the config is
   * read on the first request. A deployment that started before its configuration was ready must
   * recover on the next request rather than remember the failure for the life of the process.
   */
  it("reads the config on first use, and remembers it only once it worked", async () => {
    const thunk = vi
      .fn<() => Promise<KanzoAuthConfig>>()
      .mockRejectedValueOnce(new Error("the vault is not up yet"))
      .mockResolvedValue(config);
    const late = kanzoAuth(thunk);

    expect(thunk).not.toHaveBeenCalled();
    await expect(late.proxy(navigation("/graphs"))).rejects.toThrow(/vault/);
    expect((await late.proxy(navigation("/graphs"))).status).toBe(200);
    await late.proxy(navigation("/graphs"));

    expect(thunk).toHaveBeenCalledTimes(2);
  });

  describe("proxy", () => {
    it("replaces every incoming x-kanzo-* header, and forwards the URL and the product's own", async () => {
      const response = await auth.proxy(
        navigation("/graphs?tab=x", { "x-kanzo-url": "https://evil.test/elsewhere", "x-kanzo-anything": "forged" }),
        { headers: { "x-nonce": "n-1" } },
      );

      expect(forwarded(response, "x-kanzo-url")).toBe(`${ORIGIN}/graphs?tab=x`);
      expect(forwarded(response, "x-kanzo-anything")).toBeNull();
      expect(forwarded(response, "x-nonce")).toBe("n-1");
    });

    it("forwards the URL the browser addressed, not the one the server listens on", async () => {
      const response = await auth.proxy(
        new NextRequest("http://localhost:3000/graphs", {
          headers: { "x-forwarded-host": "acme.example.test", "x-forwarded-proto": "https" },
        }),
      );

      expect(forwarded(response, "x-kanzo-url")).toBe("https://acme.example.test/graphs");
    });

    /** The edge in front of the application decided; the proxy behind it lets every request through. */
    it("decides nothing about the session: a request with no token goes through", async () => {
      const response = await auth.proxy(navigation("/graphs"));

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    describe("csp", () => {
      const csp = { "default-src": ["'self'"], "script-src": ["'wasm-unsafe-eval'"], "worker-src": ["'self'"] };
      const nonceOf = (response: Response) => forwarded(response, "x-nonce") ?? "";

      it("sends a fresh nonce on every request and names it in script-src with strict-dynamic, without unsafe-inline", async () => {
        const guarded = kanzoAuth({ ...config, csp });
        const first = await guarded.proxy(navigation("/graphs", { "x-nonce": "forged" }));
        const second = await guarded.proxy(navigation("/graphs"));

        const nonce = nonceOf(first);
        expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
        expect(nonce).not.toBe(nonceOf(second));
        for (const response of [first, second]) {
          const policy = forwarded(response, "content-security-policy") ?? "";
          expect(policy).toBe(response.headers.get("content-security-policy"));
          expect(policy).toContain(`script-src 'nonce-${nonceOf(response)}' 'strict-dynamic' 'wasm-unsafe-eval'`);
          expect(policy).toContain("default-src 'self'; ");
          expect(policy).toContain("worker-src 'self'");
          expect(policy).not.toContain("unsafe-inline");
        }
      });

      it("gives script-src when the host gave none, and sends no policy when csp is absent", async () => {
        const bare = await kanzoAuth({ ...config, csp: { "default-src": ["'self'"] } }).proxy(navigation("/graphs"));
        expect(bare.headers.get("content-security-policy")).toMatch(/script-src 'nonce-\S+' 'strict-dynamic'/);

        const none = await auth.proxy(navigation("/graphs", { "x-nonce": "forged" }));
        expect(none.headers.get("content-security-policy")).toBeNull();
        expect(forwarded(none, "x-nonce")).toBeNull();
      });

      it("refuses unsafe-inline in script-src when the config is read", async () => {
        const unsafe = kanzoAuth({ ...config, csp: { "script-src": ["'unsafe-inline'"] } });
        await expect(unsafe.proxy(navigation("/graphs"))).rejects.toThrow(/unsafe-inline/);
      });
    });
  });

  describe("session", () => {
    it("reads the session the request carries, with the tenant the resolver names", async () => {
      auth = kanzoAuth({
        ...config,
        organization: ({ url, cookies: jar }) => jar.get("tenant")?.value ?? url.hostname.split(".")[0],
      });
      const token = await realm.sign({ organization: { app: { resource_access: { board: { roles: ["editor"] } } } } });
      rendering({ host: "app.example.test", "x-kanzo-url": `${ORIGIN}/graphs`, "x-forwarded-access-token": token });

      const session = await auth.session();

      expect(session?.user.id).toBe("u-1");
      expect(session?.organization).toBe("app");
      expect(session?.organizations[0]?.roles).toEqual(["editor"]);
    });

    it("answers null with no token, and redirects to the edge's sign-in back to the page when required", async () => {
      rendering({ host: "app.example.test", "x-kanzo-url": `${ORIGIN}/graphs/7?tab=x` });

      await expect(auth.session()).resolves.toBeNull();
      await expect(auth.session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/api/auth/sign_in?rd=%2Fgraphs%2F7%3Ftab%3Dx");
    });

    it("signs in under the configured prefix, back to the root on a page the proxy did not run on", async () => {
      rendering({ host: "app.example.test" });

      await expect(kanzoAuth({ ...config, prefix: "/oauth2" }).session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/oauth2/sign_in?rd=%2F");
    });

    /**
     * Not to sign-in: the edge holds a session and would forward the same token, so sending the
     * person there is a loop. The problem page is where a layout's `try` would have sent them.
     */
    it("sends a required session's refused token to the problem page, with its code", async () => {
      rendering({ host: "app.example.test", "x-forwarded-access-token": await realm.sign({ azp: "ledger" }) });

      await expect(auth.session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/auth/problem?code=token%2Frefused");
    });

    it("sends a required session's outage to the problem page, with its code", async () => {
      vi.stubGlobal("fetch", async () => {
        throw new TypeError("fetch failed");
      });
      rendering({ host: "app.example.test", "x-forwarded-access-token": await realm.sign() });

      await expect(auth.session({ required: true })).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalledWith("/auth/problem?code=idp%2Funreachable");
    });

    it("throws the outage to a page that did not require a session, which reads it itself", async () => {
      vi.stubGlobal("fetch", async () => {
        throw new TypeError("fetch failed");
      });
      rendering({ host: "app.example.test", "x-forwarded-access-token": await realm.sign() });

      await expect(auth.session()).rejects.toMatchObject({ code: "idp/unreachable" });
      expect(redirect).not.toHaveBeenCalled();
    });
  });
});
