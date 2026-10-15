// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kanzoAuth, type KanzoAuth, type KanzoAuthConfig } from "./next-auth";
import { FORWARD_WITHIN } from "./next-proxy";
import { CLIENT_ID, ISSUER, JWKS, localRealm, type Realm } from "./test/realm";

const ORIGIN = "https://app.example.test";
const TARGET = "https://reports.internal/v1";

/** A request the browser made from one of this application's own pages. */
function fromPage(input: string | URL, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (!headers.has("sec-fetch-site") && !headers.has("origin")) headers.set("sec-fetch-site", "same-origin");
  return new Request(input, { ...init, headers });
}

describe("kanzoAuth().api", () => {
  let realm: Realm;
  let config: KanzoAuthConfig;
  /** The resource server, and every request that reached it. */
  let upstream: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let proxy: KanzoAuth["api"];
  /** What the edge adds to a request it lets through: the session cookie it reads, and the token. */
  let edge: Record<string, string>;

  beforeEach(async () => {
    realm = await localRealm();
    config = { issuer: ISSUER, clientId: CLIENT_ID, jwks: JWKS, apis: { "/api/data": { target: TARGET } } };
    upstream = vi.fn<typeof globalThis.fetch>(
      async () => new Response("the report", { status: 200, headers: { "x-from": "upstream" } }),
    );
    // The realm's keys and the resource server are both reached with the global `fetch`; the realm
    // answers its own address and hands everything else to the resource server.
    vi.stubGlobal("fetch", realm.fetch(upstream));
    proxy = kanzoAuth(config).api;
    edge = {
      cookie: "__Host-session=opaque",
      "x-forwarded-access-token": await realm.sign({ organization: { acme: {}, globex: {} } }),
      "x-forwarded-user": "u-1",
      "x-forwarded-email": "ana@acme.test",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function sent(): { url: URL; init: RequestInit; headers: Headers } {
    const call = upstream.mock.calls[0];
    const init = (call?.[1] ?? {}) as RequestInit;
    return { url: new URL(String(call?.[0])), init, headers: new Headers(init.headers) };
  }

  it("forwards to the target under the mounted prefix, query and all", async () => {
    const response = await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports/7?format=csv`, { headers: edge }),
    );

    expect(sent().url.href).toBe("https://reports.internal/v1/reports/7?format=csv");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("the report");
    expect(response.headers.get("x-from")).toBe("upstream");
  });

  /** One BFF in front of a resource server per tenant: Keycloak's one client for every organization. */
  it("forwards to the target of the organization the request addresses", async () => {
    const tenanted = kanzoAuth({
      ...config,
      organization: (request) => request.url.hostname.split(".")[0],
      apis: {
        "/api/data": { target: (organization) => `https://${organization}.reports.internal/v1` },
      },
    });

    await tenanted.api.GET(fromPage("https://acme.app.test/api/data/reports/7", { headers: edge }));

    expect(sent().url.href).toBe("https://acme.reports.internal/v1/reports/7");
  });

  it("answers 404, and reaches nothing, for a request that addresses no organization", async () => {
    const tenanted = kanzoAuth({
      ...config,
      organization: () => undefined,
      apis: {
        "/api/data": { target: (organization) => organization && `https://${organization}.reports.internal` },
      },
    });

    const response = await tenanted.api.GET(fromPage("https://app.test/api/data/reports/7", { headers: edge }));

    expect(response.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 403, as a problem naming organization/denied, and reaches nothing, for an organization the person is not a member of", async () => {
    // The address is a hint and the token the authority: this token names globex and not acme. The
    // code is on the wire, so a host's registry reads it rather than coining its own for a bare 403.
    edge["x-forwarded-access-token"] = await realm.sign({ organization: { globex: {} } });
    const tenanted = kanzoAuth({ ...config, organization: (request) => request.url.hostname.split(".")[0] });

    const response = await tenanted.api.GET(fromPage("https://acme.app.test/api/data/reports", { headers: edge }));

    expect(response.status).toBe(403);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    expect(await response.json()).toMatchObject({ status: 403, title: "The organization is not permitted", code: "organization/denied" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("forwards each mount to its own target, the longest mount first", async () => {
    const both = kanzoAuth({
      ...config,
      apis: {
        "/api": { target: TARGET },
        "/api/search": { target: "https://search.internal/v1" },
      },
    });

    await both.api.POST(fromPage(`${ORIGIN}/api/search/query`, { method: "POST", headers: edge }));
    await both.api.GET(fromPage(`${ORIGIN}/api/searches/7`, { headers: edge }));

    expect(upstream.mock.calls.map(([url]) => String(url))).toEqual([
      "https://search.internal/v1/query",
      "https://reports.internal/v1/searches/7",
    ]);
  });

  /**
   * The line that is load-bearing and does not look it. Forwarding `cookie` hands the resource
   * server a **second credential** beside the bearer token — the edge's session — and from then on
   * a bug at the far end can act as the person rather than as the token, and the token's scope and
   * lifetime stop being the boundary.
   */
  it("does not forward the session cookie", async () => {
    await proxy.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }));

    expect(sent().headers.has("cookie")).toBe(false);
    expect(JSON.stringify([...sent().headers])).not.toContain("__Host-session");
  });

  /**
   * No exchange: the edge asked for the API's scope at sign-in, so the token it forwards already
   * names the API in `aud`, and it is the bearer as it came.
   */
  it("attaches the token the edge forwarded as the bearer, and nothing else the edge added", async () => {
    await proxy.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }));

    expect(sent().headers.get("authorization")).toBe(`Bearer ${edge["x-forwarded-access-token"]}`);
    for (const name of ["x-forwarded-access-token", "x-forwarded-user", "x-forwarded-email"]) {
      expect(sent().headers.has(name)).toBe(false);
    }
  });

  /** A header is anyone's to write; a token is only the realm's to sign. */
  it("answers 401, as a problem naming token/refused, and reaches nothing, for a token that does not verify", async () => {
    for (const token of [await realm.sign({}, { by: "stranger" }), await realm.sign({ azp: "ledger" })]) {
      const response = await proxy.GET(
        fromPage(`${ORIGIN}/api/data/reports`, { headers: { ...edge, "x-forwarded-access-token": token } }),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ status: 401, code: "token/refused" });
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 502, as a problem naming idp/unreachable, and reaches nothing, when the realm's keys cannot be fetched", async () => {
    vi.stubGlobal("fetch", upstream);
    upstream.mockRejectedValue(new TypeError("fetch failed"));

    const response = await kanzoAuth(config).api.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "idp/unreachable" });
    expect(upstream.mock.calls.map(([url]) => String(url))).toEqual([JWKS]);
  });

  it("strips the hop-by-hop headers and keeps the rest", async () => {
    await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, {
        headers: {
          ...edge,
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

  /**
   * The browser's `Origin` and Fetch Metadata describe the page behind *its* request, and the
   * same-site check has read them. Forwarded, they make the upstream judge a page that never
   * addressed it: Docker Model Runner answers any `Origin` it does not list with 403.
   */
  it("does not forward what the browser says about the page that caused its request", async () => {
    await proxy.POST(
      fromPage(`${ORIGIN}/api/data/reports`, {
        method: "POST",
        headers: {
          ...edge,
          origin: ORIGIN,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          "sec-fetch-user": "?1",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );

    const headers = sent().headers;
    for (const name of ["origin", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest", "sec-fetch-user"]) {
      expect(headers.has(name)).toBe(false);
    }
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("will not let a caller's own Authorization decide which token the upstream reads", async () => {
    await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, {
        headers: { ...edge, authorization: "Bearer somebody-elses" },
      }),
    );

    expect(sent().headers.get("authorization")).toBe(`Bearer ${edge["x-forwarded-access-token"]}`);
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

    const response = await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }),
    );

    expect(response.headers.has("content-encoding")).toBe(false);
    expect(response.headers.has("content-length")).toBe(false);
    expect(response.headers.get("content-type")).toBe("application/json");
  });

  /**
   * The browser's cookie relationship is with the edge and this origin alone. A resource server
   * that could set a cookie on this origin could set one named like the edge's.
   */
  it("does not let the upstream set cookies on this origin", async () => {
    upstream.mockResolvedValueOnce(
      new Response("", { headers: { "set-cookie": "__Host-session=theirs; Path=/" } }),
    );

    const response = await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }),
    );

    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("does not follow a redirect, because following it would send the token elsewhere", async () => {
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://evil.test/collect" } }),
    );

    const response = await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }),
    );

    expect(sent().init.redirect).toBe("manual");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://evil.test/collect");
  });

  it("streams a body out rather than reading it into memory", async () => {
    const body = new Blob(["a".repeat(64)]).stream();

    await proxy.POST(
      fromPage(`${ORIGIN}/api/data/imports`, { method: "POST", body, headers: edge, duplex: "half" } as RequestInit),
    );

    const { init } = sent();
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect((init as { duplex?: string }).duplex).toBe("half");
  });

  it("answers 401, as a problem naming session/absent, without asking upstream when the edge forwarded no token", async () => {
    const response = await proxy.GET(fromPage(`${ORIGIN}/api/data/reports`));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "session/absent" });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 403 without asking upstream when the request is not same-site", async () => {
    const response = await proxy.GET(
      fromPage(`${ORIGIN}/api/data/reports`, {
        headers: { ...edge, "sec-fetch-site": "cross-site" },
      }),
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("answers 403 without asking upstream when the request carries neither Sec-Fetch-Site nor Origin", async () => {
    const response = await proxy.GET(new Request(`${ORIGIN}/api/data/reports`, { headers: edge }));

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  /**
   * `fetch` rejects with a `TypeError` when the far end never answers; Node's carries the socket's
   * own error as its `cause`, as here. Next answered that rejection with a bare 500, so a host could
   * not tell its API being down from any other fault without coining a code of its own.
   */
  it("answers 502, as a problem naming api/unreachable, when the API refuses the connection", async () => {
    upstream.mockRejectedValue(
      new TypeError("fetch failed", { cause: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) }),
    );

    const response = await proxy.GET(fromPage(`${ORIGIN}/api/data/reports?q=secret`, { headers: edge }));

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBe("application/problem+json");
    const body = await response.json();
    expect(body).toMatchObject({ status: 502, code: "api/unreachable" });
    expect(JSON.stringify(body)).not.toContain("reports.internal");
  });

  /** An upstream that connected and says nothing, and goes when its request is aborted. */
  function hang(): void {
    upstream.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }),
    );
  }

  it("answers 504, as a problem naming api/silent, when the API sends no headers within the bound", async () => {
    hang();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const pending = proxy.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }));
      let settled = false;
      void pending.then(() => (settled = true));
      await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(FORWARD_WITHIN - 1_000);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1_000);
      const response = await pending;

      expect(response.status).toBe(504);
      expect(response.headers.get("content-type")).toBe("application/problem+json");
      expect(await response.json()).toMatchObject({
        status: 504,
        code: "api/silent",
        data: { after: FORWARD_WITHIN },
      });
      expect(upstream.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts the upstream request when the client's signal aborts", async () => {
    hang();
    const client = new AbortController();

    const pending = proxy.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge, signal: client.signal }));
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    const signal = upstream.mock.calls[0]?.[1]?.signal;
    expect(signal?.aborted).toBe(false);

    client.abort();

    await expect(pending).rejects.toBeDefined();
    expect(signal?.aborted).toBe(true);
  });

  it("does not end a response body on the clock once the headers have arrived", async () => {
    let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
    upstream.mockResolvedValue(new Response(new ReadableStream({ start: (c) => void (stream = c) })));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const response = await proxy.GET(fromPage(`${ORIGIN}/api/data/events`, { headers: edge }));
      await vi.advanceTimersByTimeAsync(FORWARD_WITHIN * 4);
      expect(upstream.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
      stream?.enqueue(new TextEncoder().encode("late"));
      stream?.close();
      expect(await response.text()).toBe("late");
    } finally {
      vi.useRealTimers();
    }
  });

  it("passes an API's own 500 through, because an answer with an error status is still its answer", async () => {
    upstream.mockResolvedValue(new Response("upstream broke", { status: 500, headers: { "x-from": "upstream" } }));

    const response = await proxy.GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge }));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("upstream broke");
    expect(response.headers.get("x-from")).toBe("upstream");
  });

  it("throws a client's own abort as it came, because a client that went away is not the API's failure", async () => {
    const client = new AbortController();
    const aborted = new TypeError("fetch failed");
    upstream.mockImplementation(async () => {
      client.abort();
      throw aborted;
    });

    const thrown = await proxy
      .GET(fromPage(`${ORIGIN}/api/data/reports`, { headers: edge, signal: client.signal }))
      .catch((error: unknown) => error);

    // The client's own reason, or the transport's rejection behind it, and never an answer.
    expect(thrown).not.toBeInstanceOf(Response);
    expect([aborted, client.signal.reason]).toContain(thrown);
  });

  it("answers 404 when kanzoAuth was given no apis", async () => {
    const response = await kanzoAuth({ ...config, apis: undefined }).api.GET(fromPage(`${ORIGIN}/api/data/reports`));

    expect(response.status).toBe(404);
  });

  /**
   * The URL parser resolves every dot segment before this handler reads a path — `..` and its
   * percent-encoded spellings alike — so a path that tried to climb has already fallen out of the
   * mount by the time it is read, and refusing what is outside the mount *is* the traversal check.
   * Asserted on the spellings rather than on the reasoning, because the reasoning rests on a
   * parser and this is what would notice if it ever stopped being true.
   */
  it("refuses a path that climbs out of the mount, however it is spelled", async () => {
    for (const path of ["/api/data/../admin", "/api/data/%2e%2e/admin", "/api/data/a/%2E%2E/%2E%2E/admin"]) {
      const response = await proxy.GET(fromPage(`${ORIGIN}${path}`, { headers: edge }));
      expect(response.status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });

  it("cannot be steered onto another host by a path that looks like one", async () => {
    await proxy.GET(fromPage(`${ORIGIN}/api/data//evil.test/collect`, { headers: edge }));

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
