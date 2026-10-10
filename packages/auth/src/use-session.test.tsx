import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./auth-provider";
import type { Auth, Session } from "./types";
import { useSession } from "./use-session";

const session: Session = {
  user: { id: "u-7", name: "Ada" },
  roles: ["auditor"],
  organizations: [{ alias: "acme", roles: ["owner"], groups: [], groupsOverage: false }],
  expiresAt: 0,
};

function authOf(overrides: Partial<Auth> = {}): Auth {
  return {
    getSession: async () => session,
    subscribe: () => () => {},
    signIn: async () => {},
    signOut: async () => {},
    fetch: globalThis.fetch,
    ...overrides,
  };
}

describe("useSession", () => {
  it("says which provider is missing, and what to pass it", async () => {
    // The error a consumer meets first. "Cannot read properties of null" would send them reading
    // this package's source; this sends them to the one line they forgot to write.
    expect(() => renderHook(() => useSession())).toThrow(/outside <AuthProvider>/);
    expect(() => renderHook(() => useSession())).toThrow(/bffAuth/);
  });

  it("hands back the session, the status and the two verbs", async () => {
    const auth = authOf();
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }) => <AuthProvider auth={auth}>{children}</AuthProvider>,
    });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.session?.user.name).toBe("Ada");
    expect(result.current.auth).toBe(auth);
  });

  it("distinguishes not-yet-looked from anonymous", async () => {
    // Both have a null session, and drawing a sign-in prompt during the first is the flicker every
    // application with a session ships at least once.
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }) => (
        <AuthProvider auth={authOf({ getSession: () => new Promise(() => {}) })}>
          {children}
        </AuthProvider>
      ),
    });

    expect(result.current.status).toBe("loading");
    expect(result.current.session).toBeNull();
  });

  it("asks a role inside the current tenant unless told which", async () => {
    const atAcme: Session = {
      ...session,
      organizations: [
        { alias: "acme", roles: ["owner"], groups: [], groupsOverage: false },
        { alias: "globex", roles: ["reader"], groups: [], groupsOverage: false },
      ],
      organization: "acme",
    };
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }) => (
        <AuthProvider auth={authOf({ getSession: async () => atAcme })}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.can("owner")).toBe(true);
    expect(result.current.can("auditor")).toBe(false);
    expect(result.current.can("reader", "globex")).toBe(true);
    expect(result.current.can("owner", "globex")).toBe(false);
  });

  it("calls through to the auth's own sign-in and sign-out", async () => {
    const signIn = vi.fn(async () => {});
    const signOut = vi.fn(async () => {});
    const { result } = renderHook(() => useSession(), {
      wrapper: ({ children }) => (
        <AuthProvider auth={authOf({ signIn, signOut })}>{children}</AuthProvider>
      ),
    });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    await result.current.signIn({ organization: "acme" });
    await result.current.signOut();

    expect(signIn).toHaveBeenCalledWith({ organization: "acme" });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
