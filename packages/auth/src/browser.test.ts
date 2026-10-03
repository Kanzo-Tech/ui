import { ErrorResponse, ErrorTimeout, UserManager, type UserManagerSettings } from "oidc-client-ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAuth, type OidcUser, type OidcUserManager } from "./browser";
import { AuthError } from "./types";

/**
 * Everything here runs against a fake `UserManager`, which is what the `createManager` seam is for.
 * What is *not* faked is the half that is ours: the claim reading, the single-flight and the store
 * choice are the real ones, and they are the only things asserted.
 *
 * What this file cannot prove: that the real `UserManager` behaves as the fake does. The compiler
 * checks the shape — `browserAuth`'s default factory returns one — and nothing here checks that
 * PKCE, discovery or the iframe work. Only a live realm can, and that check is outside this suite.
 */

/** A Keycloak ID token's claims, as a realm with organizations actually emits them. */
const PROFILE = {
  sub: "u-1",
  email: "ada@kanzo.tech",
  preferred_username: "ada",
  name: "Ada Lovelace",
  exp: 1_700_000_000,
  realm_access: { roles: ["member"] },
  resource_access: { viewer: { roles: ["admin"] } },
  organization: {
    acme: {
      id: "org-1",
      resource_access: { viewer: { roles: ["owner"] }, hub: { roles: ["reader"] } },
    },
  },
};

function user(overrides: Partial<OidcUser> = {}): OidcUser {
  return { profile: PROFILE, access_token: "t-1", expires_at: 4_000_000_000, ...overrides };
}

type Event = "userLoaded" | "userUnloaded" | "accessTokenExpired" | "userSessionChanged";

function fake(initial: OidcUser | null, renewed: OidcUser | null = user({ access_token: "t-2" })) {
  const listeners: Record<Event, Set<() => void>> = {
    userLoaded: new Set(),
    userUnloaded: new Set(),
    accessTokenExpired: new Set(),
    userSessionChanged: new Set(),
  };
  const on = (event: Event) => (cb: () => void) => {
    listeners[event].add(cb);
    return () => {
      listeners[event].delete(cb);
    };
  };

  const manager = {
    getUser: vi.fn(async () => initial),
    signinSilent: vi.fn(async () => renewed),
    signinRedirect: vi.fn(async () => {}),
    signinCallback: vi.fn(async () => undefined),
    signoutRedirect: vi.fn(async () => {}),
    events: {
      addUserLoaded: on("userLoaded"),
      addUserUnloaded: on("userUnloaded"),
      addAccessTokenExpired: on("accessTokenExpired"),
      addUserSessionChanged: on("userSessionChanged"),
    },
  } satisfies OidcUserManager;

  let settings: UserManagerSettings | undefined;
  const auth = browserAuth({
    issuer: "https://id.kanzo.tech/realms/kanzo",
    clientId: "viewer",
    createManager: (s) => {
      settings = s;
      return manager;
    },
  });

  const emit = (event: Event) => {
    for (const cb of listeners[event]) cb();
  };

  return { auth, manager, emit, listeners, settings: settings as UserManagerSettings };
}

afterEach(() => {
  globalThis.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  globalThis.sessionStorage.clear();
  globalThis.localStorage.clear();
});

describe("browserAuth", () => {
  it("reads Keycloak's claims into a Session through the one claim reader", async () => {
    const session = await fake(user()).auth.getSession();

    expect(session?.user).toEqual({
      id: "u-1",
      email: "ada@kanzo.tech",
      name: "Ada Lovelace",
      username: "ada",
    });
    // Realm roles and *this* client's roles, together; `hub`'s reader is another application's and
    // must not grant anything here.
    expect(session?.roles).toEqual(["member", "admin"]);
    expect(session?.organizations).toEqual([{ alias: "acme", id: "org-1", roles: ["owner"] }]);
    // The access token's expiry, from the token response — not the `exp` inside the ID token.
    expect(session?.expiresAt).toBe(4_000_000_000_000);
  });

  it("asks the IdP before concluding a cold load has no session", async () => {
    // The reload case, and the whole of what makes memory-only storage liveable. The store is
    // empty on every page load by construction, so answering `null` straight from it would sign
    // the person out on every F5 — which is what this file used to do while the `userStore`
    // comment promised a silent renewal would pick them up.
    // `renewed: null` is the IdP answering "nor do I".
    const { auth, manager } = fake(null, null);

    expect(await auth.getSession()).toBeNull();
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("recovers the session on a cold load when the IdP still holds one", async () => {
    // The other side of the same round trip: memory is empty, the IdP is not, and `prompt=none`
    // is what turns "no token here" back into a session.
    const { auth, manager } = fake(null);

    expect((await auth.getSession())?.user.username).toBe("ada");
    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
  });

  it("renews once for ten concurrent callers", async () => {
    // The failure this prevents is not a slow page. With the rotation RFC 10017 requires, ten
    // renewals means nine replays of a spent token, and the authorization server may revoke the
    // whole chain: the session dies, and it dies under load.
    const { auth, manager } = fake(user({ expires_at: 1 }));

    const sessions = await Promise.all(Array.from({ length: 10 }, () => auth.getSession()));

    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
    expect(sessions.every((s) => s?.user.id === "u-1")).toBe(true);
  });

  it("renews once for ten concurrent requests that all get a 401", async () => {
    const send = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("no", { status: 401 }));
    const { auth, manager } = fake(user());

    await Promise.all(Array.from({ length: 10 }, () => auth.fetch("/v1/jobs")));

    expect(manager.signinSilent).toHaveBeenCalledTimes(1);
    // Ten originals plus ten retries with the renewed token: the retry is per request, the renewal
    // is not.
    expect(send).toHaveBeenCalledTimes(20);
    const [, retry] = send.mock.calls[19] as unknown as [RequestInfo, RequestInit];
    expect(new Headers(retry.headers).get("Authorization")).toBe("Bearer t-2");
  });

  it("keeps tokens out of any storage a later page load could read", async () => {
    const { settings } = fake(user());

    await settings.userStore?.set("user:kanzo:viewer", "a-token");

    expect(await settings.userStore?.get("user:kanzo:viewer")).toBe("a-token");
    expect(globalThis.localStorage.length).toBe(0);
    expect(globalThis.sessionStorage.length).toBe(0);
  });

  it("keeps the PKCE verifier in sessionStorage, because memory does not survive the redirect", async () => {
    const { settings } = fake(user());

    await settings.stateStore?.set("a1b2", "the-verifier");

    // Not a token: it is spent by the callback and useless without the authorization code. It has
    // to outlive the navigation to the IdP, which memory does not.
    expect(globalThis.sessionStorage.getItem("oidc.a1b2")).toBe("the-verifier");
    expect(globalThis.localStorage.length).toBe(0);
  });

  it("asks for organization:* by default", async () => {
    // Plain `organization` prompts for a choice when the person belongs to several, which reads as
    // the claim having disappeared.
    expect(fake(user()).settings.scope).toBe("openid profile email organization:*");
  });

  it("narrows the scope to one organization on request", async () => {
    const { auth, manager } = fake(user());

    await auth.signIn({ organization: "acme", returnTo: "http://localhost:3000/jobs" });

    expect(manager.signinRedirect).toHaveBeenCalledWith({
      scope: "openid profile email organization:acme",
      url_state: "http://localhost:3000/jobs",
    });
  });

  it("signs out through the library's RP-initiated logout", async () => {
    const { auth, manager } = fake(user());

    await auth.signOut({ returnTo: "http://localhost:3000/bye" });

    expect(manager.signoutRedirect).toHaveBeenCalledWith({
      post_logout_redirect_uri: "http://localhost:3000/bye",
    });
  });

  it("bridges all four of the manager's events to one onChange", () => {
    const { auth, emit } = fake(user());
    const onChange = vi.fn();
    auth.subscribe(onChange);

    emit("userLoaded");
    emit("userUnloaded");
    emit("accessTokenExpired");
    emit("userSessionChanged");

    expect(onChange).toHaveBeenCalledTimes(4);
  });

  it("really detaches on unsubscribe", () => {
    const { auth, emit, listeners } = fake(user());
    const onChange = vi.fn();

    const unsubscribe = auth.subscribe(onChange);
    unsubscribe();
    emit("userLoaded");
    emit("userUnloaded");
    emit("accessTokenExpired");
    emit("userSessionChanged");

    expect(onChange).not.toHaveBeenCalled();
    // A callback that stops being called but stays in the set is a leak, not an unsubscribe: a
    // provider that mounts and unmounts a hundred times would hold a hundred dead closures.
    expect(Object.values(listeners).every((set) => set.size === 0)).toBe(true);
  });

  it("bounds every request the library makes to the IdP at 30 s", () => {
    expect(fake(user()).settings.requestTimeoutInSeconds).toBe(30);
  });
});

describe("browserAuth tells no session apart from a failing IdP", () => {
  it("reads a silent renewal the IdP answers with login_required as no session", async () => {
    const { auth, manager } = fake(null);
    manager.signinSilent.mockRejectedValueOnce(new ErrorResponse({ error: "login_required" }));

    expect(await auth.getSession()).toBeNull();
  });

  it("reads a refresh token the IdP no longer honours as no session", async () => {
    const { auth, manager } = fake(user({ expires_at: 1 }));
    manager.signinSilent.mockRejectedValueOnce(new ErrorResponse({ error: "invalid_grant" }));

    expect(await auth.getSession()).toBeNull();
  });

  it("throws an IdP that refuses the client, with the refusal as the cause", async () => {
    const { auth, manager } = fake(null);
    const refusal = new ErrorResponse({ error: "unauthorized_client" });
    manager.signinSilent.mockRejectedValueOnce(refusal);

    const failed = await auth.getSession().catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(AuthError);
    expect(failed).toMatchObject({ code: "token/exchange-failed" });
    expect((failed as AuthError).cause).toBe(refusal);
  });

  it("throws an IdP that cannot be reached as idp/unreachable", async () => {
    const { auth, manager } = fake(null);
    const offline = new TypeError("Failed to fetch");
    manager.signinSilent.mockRejectedValueOnce(offline);

    const failed = await auth.getSession().catch((error: unknown) => error);

    expect(failed).toMatchObject({ code: "idp/unreachable" });
    expect((failed as AuthError).cause).toBe(offline);
  });

  it("throws an IdP that does not answer as idp/silent, after the 30 s it was given", async () => {
    const { auth, manager } = fake(null);
    manager.signinSilent.mockRejectedValueOnce(new ErrorTimeout("IFrame timed out without a response"));

    await expect(auth.getSession()).rejects.toMatchObject({ code: "idp/silent", data: { after: 30_000 } });
  });

  it("renews again on the next call after a renewal failed", async () => {
    const { auth, manager } = fake(null);
    manager.signinSilent.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(auth.getSession()).rejects.toMatchObject({ code: "idp/unreachable" });
    expect((await auth.getSession())?.user.id).toBe("u-1");
    expect(manager.signinSilent).toHaveBeenCalledTimes(2);
  });

  it("reads a callback whose state this tab does not hold as no session, in the library's own words", async () => {
    // The real `UserManager` reads the state store before any request, so its message is pinned
    // here rather than transcribed: if the library rewords it, this fails instead of a stale
    // callback URL becoming an error on every reload.
    globalThis.history.replaceState(null, "", "/?code=c&state=nobody-sent-this");
    const { auth, manager, settings } = fake(null, null);
    const real = new UserManager(settings);
    manager.signinCallback.mockImplementation(((url?: string) => real.signinCallback(url)) as never);

    expect(await auth.getSession()).toBeNull();
    expect(globalThis.location.search).toBe("");
  });

  it("throws a callback the IdP refused, cleans the URL, and does not keep the failure", async () => {
    globalThis.history.replaceState(null, "", "/?code=c&state=s");
    const { auth, manager } = fake(user());
    const refusal = new ErrorResponse({ error: "invalid_grant" });
    manager.signinCallback.mockRejectedValueOnce(refusal);

    const failed = await auth.getSession().catch((error: unknown) => error);

    expect(failed).toMatchObject({ code: "token/exchange-failed" });
    expect((failed as AuthError).cause).toBe(refusal);
    expect(globalThis.location.search).toBe("");
    expect((await auth.getSession())?.user.id).toBe("u-1");
    expect(manager.signinCallback).toHaveBeenCalledTimes(1);
  });

  it("reads the manager after the callback, rather than the callback's user forever", async () => {
    globalThis.history.replaceState(null, "", "/?code=c&state=s");
    const { auth, manager } = fake(user({ access_token: "from-store" }));
    manager.signinCallback.mockResolvedValueOnce(user({ access_token: "from-callback" }) as never);

    await auth.getSession();
    await auth.getSession();

    expect(manager.signinCallback).toHaveBeenCalledTimes(1);
    expect(manager.getUser).toHaveBeenCalledTimes(1);
  });
});
