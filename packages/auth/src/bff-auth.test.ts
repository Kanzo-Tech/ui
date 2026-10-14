import { afterEach, describe, expect, it, vi } from "vitest";
import { bffAuth, readSession } from "./bff-auth";
import { AuthError } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

const body = {
  user: { id: "u-7", email: "ada@example.com", name: "Ada", username: "ada" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", id: "f8d3", roles: ["owner"], groups: ["g-research"], groupsOverage: false },
    { alias: "globex", roles: [], groups: [], groupsOverage: true },
  ],
  organization: "acme",
  expiresAt: Date.UTC(2099, 0, 1),
};

function responds(make: () => Response): typeof globalThis.fetch {
  return async () => make();
}

function jsonOnce(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readSession checks the wire instead of casting it", () => {
  it("reads a well-formed body", () => {
    const session = readSession(body);
    expect(session?.user).toEqual({
      id: "u-7",
      email: "ada@example.com",
      name: "Ada",
      username: "ada",
    });
    expect(session?.roles).toEqual(["auditor"]);
    expect(session?.organizations).toEqual([
      { alias: "acme", id: "f8d3", roles: ["owner"], groups: ["g-research"], groupsOverage: false },
      { alias: "globex", id: undefined, roles: [], groups: [], groupsOverage: true },
    ]);
    expect(session?.organization).toBe("acme");
    expect(session?.expiresAt).toBe(Date.UTC(2099, 0, 1));
  });

  it("refuses anything that is not a session", () => {
    // A deploy skew or a proxy's error page is what actually arrives here. Cast, and it becomes a
    // `Session` whose `user` is undefined, failing three components away on a property read.
    expect(readSession("<!DOCTYPE html><title>502 Bad Gateway</title>")).toBeNull();
    expect(readSession(null)).toBeNull();
    expect(readSession([])).toBeNull();
    expect(readSession({})).toBeNull();
    expect(readSession({ user: null })).toBeNull();
    expect(readSession({ user: {} })).toBeNull();
    expect(readSession({ user: { id: "" } })).toBeNull();
    expect(readSession({ user: { id: 7 } })).toBeNull();
  });

  it("degrades the parts that are allowed to be missing", () => {
    // Holding no roles and belonging to nothing are legitimate states — monotenant is this shape.
    const session = readSession({ user: { id: "u-1" } });
    expect(session).toEqual({
      user: { id: "u-1", email: undefined, name: undefined, username: undefined },
      roles: [],
      organizations: [],
      organization: undefined,
      expiresAt: 0,
    });
  });

  it("drops the members of a list it cannot read, and keeps the rest", () => {
    const session = readSession({
      user: { id: "u-1" },
      roles: ["real", 7, null],
      organizations: [
        { alias: "acme", roles: ["owner", 3], groups: ["g-1", null] },
        { id: "no-alias" },
        "acme",
      ],
    });
    expect(session?.roles).toEqual(["real"]);
    expect(session?.organizations).toEqual([
      { alias: "acme", id: undefined, roles: ["owner"], groups: ["g-1"], groupsOverage: false },
    ]);
  });
});

describe("bffAuth", () => {
  it("asks once for a burst of callers", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });

    // Six components mounting in one tick. Without single-flight this is six requests for one
    // answer — cheaper than the token path's revoked chain, and the same mistake.
    const sessions = await Promise.all(Array.from({ length: 6 }, () => auth.getSession()));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Set(sessions.map((s) => s?.user.id))).toEqual(new Set(["u-7"]));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/session");
  });

  it("reads the session each time it is asked, because the provider's query is the one copy", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.getSession();
    await auth.getSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renews a session read within a minute of its expiry, and answers the renewed one", async () => {
    // The tab that stays on one page past its access token: the proxy renews before a page, and
    // nothing renewed for a tab that loaded none, so it drew an `expiresAt` already gone.
    const renewed = { ...body, expiresAt: Date.now() + 3_600_000, roles: ["auditor", "editor"] };
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).endsWith("/refresh") ? jsonOnce(renewed) : jsonOnce({ ...body, expiresAt: Date.now() + 30_000 }),
    );
    const auth = bffAuth({ fetch: fetchMock });

    const session = await auth.getSession();

    expect(session?.roles).toEqual(["auditor", "editor"]);
    expect(fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? "GET"} ${String(input)}`)).toEqual([
      "GET /api/auth/session",
      "POST /api/auth/refresh",
    ]);
  });

  it("answers nobody when the renewal of an expiring session is refused", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).endsWith("/refresh")
        ? new Response("", { status: 401 })
        : jsonOnce({ ...body, expiresAt: Date.now() - 1 }),
    );
    await expect(bffAuth({ fetch: fetchMock }).getSession()).resolves.toBeNull();
  });

  it("tells the other tabs when it loads, renews and signs out, and hears theirs", async () => {
    // Auth.js's `BroadcastChannel`: a sign-out in one tab signs out the others, and a sign-in that
    // came back to a fresh page is read by the tabs already open. The message is only that something
    // changed; each tab reads its own answer.
    const basePath = "/tabs/api/auth";
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) =>
      String(input).endsWith("/session") ? jsonOnce(body) : new Response("", { status: 401 }),
    );
    const here = bffAuth({ basePath, fetch: fetchMock, navigate: () => {} });
    const there = bffAuth({ basePath, fetch: fetchMock, navigate: () => {} });
    const heard = vi.fn();
    const heardHere = vi.fn();
    const stop = there.subscribe(heard);
    const stopHere = here.subscribe(heardHere);

    try {
      await here.getSession();
      await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(1));
      await here.getSession();
      await here.signOut();
      await vi.waitFor(() => expect(heard).toHaveBeenCalledTimes(2));
      // A tab does not hear itself, so its own read is never a reason to read again.
      expect(heardHere).not.toHaveBeenCalled();
    } finally {
      stop();
      stopHere();
    }
  });

  it("reads a 401 from the session endpoint as nobody being signed in", async () => {
    // Not a failure to report: it is the documented answer, and the tree must render anonymous
    // rather than hold a spinner.
    const auth = bffAuth({ fetch: responds(() => new Response("", { status: 401 })) });
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it("reads a 5xx from the session endpoint as a failure, not as nobody being signed in", async () => {
    const auth = bffAuth({ fetch: responds(() => new Response("", { status: 502 })) });

    const failed = await auth.getSession().catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(AuthError);
    expect(failed).toMatchObject({ code: "session/unavailable", data: { status: 502 } });
  });

  it("reads a 200 that is not a session as a failure — a proxy's page, a deploy skew", async () => {
    const html = bffAuth({ fetch: responds(() => new Response("<html>oops</html>")) });
    const empty = bffAuth({ fetch: responds(() => jsonOnce({})) });

    await expect(html.getSession()).rejects.toMatchObject({ code: "session/unavailable", data: { status: 200 } });
    await expect(empty.getSession()).rejects.toMatchObject({ code: "session/unavailable" });
  });

  it("keeps what the network threw as the cause", async () => {
    const offline = new TypeError("Failed to fetch");
    const auth = bffAuth({
      fetch: async () => {
        throw offline;
      },
    });

    const failed = await auth.getSession().catch((error: unknown) => error);

    expect(failed).toMatchObject({ code: "session/unavailable" });
    expect((failed as AuthError).cause).toBe(offline);
  });

  it("asks again after a failed read, rather than keeping the failure", async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => new Response("", { status: 503 }))
      .mockImplementationOnce(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });

    await expect(auth.getSession()).rejects.toMatchObject({ code: "session/unavailable" });
    expect((await auth.getSession())?.user.id).toBe("u-7");
  });

  it("gives up on a session endpoint that never answers, after 30 s and not before", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const auth = bffAuth({
      fetch: (_input, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      },
    });

    const settled = vi.fn();
    const read = auth.getSession().then(settled, (error: unknown) => {
      settled(error);
      return error;
    });

    await vi.advanceTimersByTimeAsync(29_999);
    expect(settled).not.toHaveBeenCalled();
    expect(signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const failed = await read;
    expect(failed).toBeInstanceOf(AuthError);
    expect(failed).toMatchObject({ code: "session/silent", data: { after: 30_000 } });
    expect(signal?.aborted).toBe(true);
  });

  /**
   * The failure this retry exists for, in the shape the host measured it: a session cookie good
   * for eight hours in front of an access token good for one. For the seven hours in between,
   * `/session` answers 200 and the whole application draws while every request for data is a 401 —
   * and before this, nothing in the package turned that into a renewal.
   */
  it("renews and retries once when a request comes back 401, and has the provider read again", async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => jsonOnce(body))
      .mockImplementationOnce(async () => new Response("no", { status: 401 }))
      .mockImplementationOnce(async () => jsonOnce(body))
      .mockImplementationOnce(async () => new Response("the jobs", { status: 200 }));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.getSession();
    const changed = vi.fn();
    auth.subscribe(changed);

    const response = await auth.fetch("/v1/jobs");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("the jobs");
    // The renewal is a POST to the refresh route, and the request that saw the 401 is sent again.
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe("POST");
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/v1/jobs");
    // The provider reads the renewed session: its roles and its expiry may both have moved.
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("spends one renewal for a burst of 401s", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).endsWith("/session")) return jsonOnce(body);
      if (String(input).endsWith("/refresh")) return jsonOnce(body);
      return new Response("", { status: 401 });
    });
    const auth = bffAuth({ fetch: fetchMock });
    await auth.getSession();

    // Six components noticing at once is six refresh tokens replayed under rotation, and an
    // authorization server is entitled to read that as theft and revoke the chain.
    await Promise.all(Array.from({ length: 6 }, () => auth.fetch("/v1/jobs")));

    const renewals = fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/refresh"));
    expect(renewals).toHaveLength(1);
  });

  /**
   * The one layer that answers an ended session in the browser. Before it, every product wrote its
   * own `401 → signIn()` branch in its data client, and a page that fired six queries at an ended
   * session navigated six times.
   */
  it("signs in once, back to this page, when the renewal is refused", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).endsWith("/session")) return jsonOnce(body);
      return new Response("", { status: 401 });
    });
    const navigate = vi.fn();
    const auth = bffAuth({ fetch: fetchMock, navigate });
    await auth.getSession();

    const responses = await Promise.all([auth.fetch("/v1/jobs"), auth.fetch("/v1/graphs")]);
    await auth.fetch("/v1/later");

    // The callers still see their own 401s; the session is over, and the sign-in carries the page.
    expect(responses.map((r) => r.status)).toEqual([401, 401]);
    expect(navigate).toHaveBeenCalledTimes(1);
    const away = new URL(navigate.mock.calls[0]?.[0] as string, "https://app.example.test");
    expect(away.pathname).toBe("/api/auth/signin");
    expect(away.searchParams.get("returnTo")).toBe(globalThis.location.href);
  });

  it("rejects the request rather than ending the session when the refresh route is down", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).endsWith("/session")) return jsonOnce(body);
      if (String(input).endsWith("/refresh")) return new Response("", { status: 503 });
      return new Response("", { status: 401 });
    });
    const auth = bffAuth({ fetch: fetchMock });
    await auth.getSession();

    await expect(auth.fetch("/v1/jobs")).rejects.toMatchObject({
      code: "session/unavailable",
      data: { status: 503 },
    });
    expect((await auth.getSession())?.user.id).toBe("u-7");
  });

  it("does not retry a request whose body cannot be sent twice", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).endsWith("/session")) return jsonOnce(body);
      if (String(input).endsWith("/refresh")) return jsonOnce(body);
      return new Response("", { status: 401 });
    });
    const auth = bffAuth({ fetch: fetchMock });
    await auth.getSession();

    // A stream is read once. Retrying it sends an empty body and a misleading error at the far
    // end, which is worse than the 401 the caller was going to see anyway.
    const body_ = new ReadableStream();
    const response = await auth.fetch("/v1/upload", { method: "POST", body: body_ });

    expect(response.status).toBe(401);
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/v1/upload")).toHaveLength(1);
  });

  it("passes a request that is not a 401 straight through", async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => jsonOnce(body))
      .mockImplementationOnce(async () => new Response("forbidden", { status: 403 }));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.getSession();
    expect((await auth.fetch("/v1/jobs")).status).toBe(403);
    // A 403 is an answer, not a stale credential: re-reading the session would be a second request
    // for nothing and a spurious re-render.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("attaches no Authorization header, because the cookie rides along by itself", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.fetch("/v1/jobs", { headers: { "X-Trace": "1" } });

    const init = fetchMock.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    expect(new Headers(init?.headers).get("X-Trace")).toBe("1");
  });

  it("stops announcing to a listener that unsubscribed", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });
    const changed = vi.fn();
    const unsubscribe = auth.subscribe(changed);
    unsubscribe();

    await auth.getSession();
    expect(changed).not.toHaveBeenCalled();
  });

  it("sends sign-in to the server's route, carrying where to come back to", async () => {
    const navigate = vi.fn();
    const auth = bffAuth({ navigate, fetch: responds(() => jsonOnce(body)) });

    await auth.signIn({ returnTo: "https://acme.kanzo.tech/jobs/7", organization: "acme" });

    const url = new URL(navigate.mock.calls[0]?.[0] as string, "https://acme.kanzo.tech");
    expect(url.pathname).toBe("/api/auth/signin");
    expect(url.searchParams.get("returnTo")).toBe("https://acme.kanzo.tech/jobs/7");
    expect(url.searchParams.get("organization")).toBe("acme");
  });

  it("defaults the return to where the person is, and honours a moved base path", async () => {
    const navigate = vi.fn();
    const auth = bffAuth({ navigate, basePath: "/auth/", fetch: responds(() => jsonOnce(body)) });

    await auth.signIn();

    const url = new URL(navigate.mock.calls[0]?.[0] as string, globalThis.location.href);
    expect(url.pathname).toBe("/auth/signin");
    expect(url.searchParams.get("returnTo")).toBe(globalThis.location.href);
    expect(url.searchParams.get("organization")).toBeNull();
  });

  it("sends sign-out to the server's route, with and without a destination", async () => {
    const navigate = vi.fn();
    const auth = bffAuth({ navigate, fetch: responds(() => jsonOnce(body)) });

    await auth.signOut();
    expect(navigate).toHaveBeenLastCalledWith("/api/auth/signout");

    await auth.signOut({ returnTo: "/goodbye" });
    expect(navigate).toHaveBeenLastCalledWith("/api/auth/signout?returnTo=%2Fgoodbye");
  });
});
