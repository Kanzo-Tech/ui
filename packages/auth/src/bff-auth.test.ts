import { describe, expect, it, vi } from "vitest";
import { bffAuth, readSession } from "./bff-auth";

const body = {
  user: { id: "u-7", email: "ada@example.com", name: "Ada", username: "ada" },
  roles: ["auditor"],
  organizations: [{ alias: "acme", id: "f8d3", groups: ["ignored"], roles: ["owner"] }],
  expiresAt: 1_700_000_000_000,
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
    expect(session?.organizations).toEqual([{ alias: "acme", id: "f8d3", roles: ["owner"] }]);
    expect(session?.expiresAt).toBe(1_700_000_000_000);
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
      expiresAt: 0,
    });
  });

  it("drops the members of a list it cannot read, and keeps the rest", () => {
    const session = readSession({
      user: { id: "u-1" },
      roles: ["real", 7, null],
      organizations: [{ alias: "acme", roles: ["owner", 3] }, { id: "no-alias" }, "acme"],
    });
    expect(session?.roles).toEqual(["real"]);
    expect(session?.organizations).toEqual([{ alias: "acme", id: undefined, roles: ["owner"] }]);
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

  it("answers from cache after the first read", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonOnce(body));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.getSession();
    await auth.getSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads a 401 from the session endpoint as nobody being signed in", async () => {
    // Not a failure to report: it is the documented answer, and the tree must render anonymous
    // rather than hold a spinner.
    const auth = bffAuth({ fetch: responds(() => new Response("", { status: 401 })) });
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it("reads a broken session endpoint as nobody being signed in", async () => {
    const auth = bffAuth({ fetch: responds(() => new Response("<html>oops</html>")) });
    await expect(auth.getSession()).resolves.toBeNull();
  });

  it("re-reads the session when a request comes back 401, and tells the tree", async () => {
    const fetchMock = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementationOnce(async () => jsonOnce(body))
      .mockImplementationOnce(async () => new Response("no", { status: 401 }))
      .mockImplementationOnce(async () => new Response("", { status: 401 }));
    const auth = bffAuth({ fetch: fetchMock });

    await auth.getSession();
    // Subscribed after the first read, because arriving at a session is itself a change and
    // announces one. What is under test is the second announcement: the session going away.
    const changed = vi.fn();
    auth.subscribe(changed);

    const response = await auth.fetch("/v1/jobs");

    // The caller still sees its own 401 — the session is gone, not stale, and there is nothing to
    // retry with.
    expect(response.status).toBe(401);
    await expect(auth.getSession()).resolves.toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
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
