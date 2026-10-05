// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kanzoAuth, type KanzoAuth, type KanzoAuthConfig } from "./next-auth";
import {
  CLIENT_ID,
  ISSUER,
  ORIGIN,
  SECRET,
  asRequestHeader,
  fakeKeycloak,
  type Realm,
} from "./test/fake-keycloak";

const TARGET = "https://reports.internal/v1";

describe("kanzoAuth().api", () => {
  let realm: Realm;
  let config: KanzoAuthConfig;
  let routes: KanzoAuth["routes"];
  /** The resource server, and every request that reached it. */
  let upstream: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let proxy: KanzoAuth["api"];

  beforeEach(() => {
    realm = fakeKeycloak();
    realm.state.accessToken = "at-1";
    realm.state.expiresIn = 3600;
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: SECRET,
      fetch: realm.fetchImpl,
      api: { mount: "/api/data", target: TARGET },
    };
    const auth = kanzoAuth(config);
    routes = auth.routes;
    upstream = vi.fn<typeof globalThis.fetch>(
      async () => new Response("the report", { status: 200, headers: { "x-from": "upstream" } }),
    );
    // The resource server is reached with the global `fetch`, deliberately and not through a
    // config field: `IssuerConfig.fetch` — which `config` carries, pointed at the fake realm — is
    // the transport to *Keycloak*, and one name for both is how a product's internal-origin
    // Keycloak transport quietly starts carrying its API traffic. Stubbing the global here is
    // therefore the same separation the design makes, asserted by the fact that these two mocks
    // never see each other's requests.
    vi.stubGlobal("fetch", upstream);
    proxy = auth.api;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  function sent(): { url: URL; init: RequestInit; headers: Headers } {
    const call = upstream.mock.calls[0];
    const init = (call?.[1] ?? {}) as RequestInit;
    return { url: new URL(String(call?.[0])), init, headers: new Headers(init.headers) };
  }

  it("forwards to the target under the mounted prefix, query and all", async () => {
    const cookie = await signIn();

    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports/7?format=csv`, { headers: { cookie } }),
    );

    expect(sent().url.href).toBe("https://reports.internal/v1/reports/7?format=csv");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("the report");
    expect(response.headers.get("x-from")).toBe("upstream");
  });

  /** One BFF in front of a resource server per tenant: Keycloak's one client for every organization. */
  it("forwards to the target of the organization the request addresses", async () => {
    const cookie = await signIn();
    const tenanted = kanzoAuth({
      ...config,
      organization: (request) => request.url.hostname.split(".")[0],
      api: { mount: "/api/data", target: (organization) => `https://${organization}.reports.internal/v1` },
    });

    await tenanted.api.GET(new Request("https://acme.app.test/api/data/reports/7", { headers: { cookie } }));

    expect(sent().url.href).toBe("https://acme.reports.internal/v1/reports/7");
  });

  it("answers 404, and reaches nothing, for a request that addresses no organization", async () => {
    const cookie = await signIn();
    const tenanted = kanzoAuth({
      ...config,
      organization: () => undefined,
      api: { mount: "/api/data", target: (organization) => organization && `https://${organization}.reports.internal` },
    });

    const response = await tenanted.api.GET(new Request("https://app.test/api/data/reports/7", { headers: { cookie } }));

    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("attaches the access token as a bearer", async () => {
    realm.state.accessToken = "the-bearer-token";
    const cookie = await signIn();

    await proxy.GET(new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }));

    expect(sent().headers.get("authorization")).toBe("Bearer the-bearer-token");
  });

  /**
   * The line that is load-bearing and does not look it. Forwarding `cookie` hands the resource
   * server a **second credential** beside the bearer token it asked for — which is exactly the
   * confusion the BFF pattern exists to remove: from then on a bug at the far end can act as the
   * person rather than as the token, and the token's scope and lifetime stop being the boundary.
   */
  it("does not forward the session cookie", async () => {
    const cookie = await signIn();

    await proxy.GET(new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }));

    expect(sent().headers.has("cookie")).toBe(false);
    expect(JSON.stringify([...sent().headers])).not.toContain("kanzo-session");
  });

  it("strips the hop-by-hop headers and keeps the rest", async () => {
    const cookie = await signIn();

    await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, {
        headers: {
          cookie,
          connection: "keep-alive",
          te: "trailers",
          upgrade: "websocket",
          "accept-encoding": "gzip",
          "x-trace": "abc",
          accept: "application/json",
        },
      }),
    );

    const headers = sent().headers;
    for (const name of ["connection", "te", "upgrade", "accept-encoding"]) {
      expect(headers.has(name)).toBe(false);
    }
    expect(headers.get("x-trace")).toBe("abc");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("will not let a caller's own Authorization decide which token the upstream reads", async () => {
    const cookie = await signIn();

    await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, {
        headers: { cookie, authorization: "Bearer somebody-elses" },
      }),
    );

    expect(sent().headers.get("authorization")).toBe("Bearer at-1");
  });

  /**
   * `fetch` decodes the body on the way in, so an upstream `content-encoding: gzip` passed through
   * describes a representation that no longer exists — and no browser recovers from that. The same
   * goes for a `content-length` measured before the decode.
   */
  it("does not return headers describing a body that was already decoded", async () => {
    upstream.mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-encoding": "gzip", "content-length": "17", "content-type": "application/json" },
      }),
    );
    const cookie = await signIn();

    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }),
    );

    expect(response.headers.has("content-encoding")).toBe(false);
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  /**
   * Under this pattern the browser's cookie relationship is with the BFF alone. A resource server
   * that could set a cookie on this origin could set one named like ours.
   */
  it("does not let the upstream set cookies on this origin", async () => {
    upstream.mockResolvedValueOnce(
      new Response("", { headers: { "set-cookie": "__Host-kanzo-session=theirs; Path=/" } }),
    );
    const cookie = await signIn();

    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }),
    );

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("does not follow a redirect, because following it would send the token elsewhere", async () => {
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://evil.test/collect" } }),
    );
    const cookie = await signIn();

    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }),
    );

    expect(sent().init.redirect).toBe("manual");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://evil.test/collect");
  });

  it("streams a body out rather than reading it into memory", async () => {
    const cookie = await signIn();
    const body = new Blob(["a".repeat(64)]).stream();

    await proxy.POST(
      new Request(`${ORIGIN}/api/data/imports`, { method: "POST", body, headers: { cookie }, duplex: "half" } as RequestInit),
    );

    const { init } = sent();
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect((init as { duplex?: string }).duplex).toBe("half");
  });

  it("answers 401 without asking upstream when there is no session", async () => {
    const response = await proxy.GET(new Request(`${ORIGIN}/api/data/reports`));

    expect(response.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 403 without asking upstream when the request is not same-site", async () => {
    const cookie = await signIn();

    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, {
        headers: { cookie, "sec-fetch-site": "cross-site" },
      }),
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("renews an expiring token and attaches the reissued cookie to the answer", async () => {
    realm.state.expiresIn = 20;
    const cookie = await signIn();

    realm.state.accessToken = "renewed";
    const response = await proxy.GET(
      new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }),
    );

    expect(response.status).toBe(200);
    expect(sent().headers.get("authorization")).toBe("Bearer renewed");
    const reissued = response.headers.getSetCookie();
    expect(reissued).toHaveLength(1);
    expect(reissued[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
  });

  it("answers 401 and clears the cookie when the IdP refuses to renew", async () => {
    realm.state.expiresIn = 20;
    const cookie = await signIn();
    realm.state.refusingRefresh = true;

    const response = await proxy.GET(new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }));

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()[0]).toContain("Max-Age=0");
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 404 when kanzoAuth was given no api", async () => {
    const response = await kanzoAuth({ ...config, api: undefined }).api.GET(new Request(`${ORIGIN}/api/data/reports`));

    expect(response.status).toBe(404);
  });

  it("answers 502, not 401, when the IdP cannot be reached to renew", async () => {
    realm.state.expiresIn = 20;
    const cookie = await signIn();
    const down = kanzoAuth({
      ...config,
      fetch: (async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/token")) throw new TypeError("fetch failed");
        return realm.fetchImpl(input);
      }) as typeof globalThis.fetch,
    }).api;

    const response = await down.GET(new Request(`${ORIGIN}/api/data/reports`, { headers: { cookie } }));

    expect(response.status).toBe(502);
    expect(upstream).not.toHaveBeenCalled();
  });

  /**
   * The URL parser resolves every dot segment before this handler reads a path — `..` and its
   * percent-encoded spellings alike — so a path that tried to climb has already fallen out of the
   * mount by the time it is read, and refusing what is outside the mount *is* the traversal check.
   * Asserted on the spellings rather than on the reasoning, because the reasoning rests on a
   * parser and this is what would notice if it ever stopped being true.
   */
  it("refuses a path that climbs out of the mount, however it is spelled", async () => {
    const cookie = await signIn();

    for (const path of ["/api/data/../admin", "/api/data/%2e%2e/admin", "/api/data/a/%2E%2E/%2E%2E/admin"]) {
      const response = await proxy.GET(new Request(`${ORIGIN}${path}`, { headers: { cookie } }));
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("cannot be steered onto another host by a path that looks like one", async () => {
    const cookie = await signIn();

    await proxy.GET(new Request(`${ORIGIN}/api/data//evil.test/collect`, { headers: { cookie } }));

    // `//evil.test/collect` parsed as a *URL* is protocol-relative and names another host, which
    // is what composing this as a string rather than assigning `pathname` would have produced.
    expect(sent().url.origin).toBe("https://reports.internal");
  });

  it("serves every verb a route file can export", () => {
    expect(Object.keys(proxy).sort()).toEqual([
      "DELETE",
      "GET",
      "HEAD",
      "OPTIONS",
      "PATCH",
      "POST",
      "PUT",
    ]);
  });
});
