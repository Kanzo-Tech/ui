import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "./auth-context";
import { AuthProvider } from "./auth-provider";
import { Queries } from "./test/queries";
import type { Auth, Session } from "./types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sessionOf(id: string): Session {
  return { user: { id }, roles: [], organizations: [], expiresAt: 0 };
}

function authOf(overrides: Partial<Auth> = {}): Auth {
  return {
    getSession: async () => null,
    subscribe: () => () => {},
    signIn: async () => {},
    signOut: async () => {},
    fetch: globalThis.fetch,
    ...overrides,
  };
}

function Probe() {
  const context = useContext(AuthContext);
  const text = `${context?.status}:${context?.session?.user.id ?? "-"}`;
  return <span data-testid="probe">{text}</span>;
}

const probe = () => screen.getByTestId("probe").textContent;

describe("AuthProvider holds the session and keeps it current", () => {
  it("starts loading and settles on the session it read", async () => {
    const gate = deferred<Session | null>();
    render(
      <AuthProvider auth={authOf({ getSession: () => gate.promise })}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );

    expect(probe()).toBe("loading:-");
    await act(async () => gate.resolve(sessionOf("u-7")));
    await waitFor(() => expect(probe()).toBe("authenticated:u-7"));
  });

  it("settles on anonymous when there is no session", async () => {
    render(
      <AuthProvider auth={authOf({ getSession: async () => null })}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );
    await waitFor(() => expect(probe()).toBe("anonymous:-"));
  });

  it("settles on failed when the read fails, holding exactly what was thrown", async () => {
    // Not "anonymous", which sends the person to sign in over an outage, and not "loading", which
    // is a spinner nobody can escape.
    const thrown = new Error("the IdP is down");
    let seen: unknown;
    function Failure() {
      seen = useContext(AuthContext)?.error;
      return null;
    }
    render(
      <AuthProvider auth={authOf({ getSession: () => Promise.reject(thrown) })}>
        <Probe />
        <Failure />
      </AuthProvider>,
      { wrapper: Queries },
    );

    await waitFor(() => expect(probe()).toBe("failed:-"));
    expect(seen).toBe(thrown);
  });

  it("clears the failure when a later read succeeds", async () => {
    let announce = () => {};
    let attempt = 0;
    let seen: unknown = "unset";
    function Failure() {
      seen = useContext(AuthContext)?.error;
      return null;
    }
    const auth = authOf({
      getSession: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("offline");
        return sessionOf("u-3");
      },
      subscribe: (onChange) => {
        announce = onChange;
        return () => {};
      },
    });

    render(
      <AuthProvider auth={auth}>
        <Probe />
        <Failure />
      </AuthProvider>,
      { wrapper: Queries },
    );
    await waitFor(() => expect(probe()).toBe("failed:-"));

    await act(async () => announce());
    await waitFor(() => expect(probe()).toBe("authenticated:u-3"));
    expect(seen).toBeUndefined();
  });

  it("re-reads when the auth announces a change", async () => {
    let announce = () => {};
    let current: Session | null = null;
    const auth = authOf({
      getSession: async () => current,
      subscribe: (onChange) => {
        announce = onChange;
        return () => {};
      },
    });

    render(
      <AuthProvider auth={auth}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );
    await waitFor(() => expect(probe()).toBe("anonymous:-"));

    current = sessionOf("u-9");
    await act(async () => announce());
    await waitFor(() => expect(probe()).toBe("authenticated:u-9"));
  });

  it("does not let a slow answer from a replaced auth overwrite the current one", async () => {
    // Each `Auth` is its own key on the client, so the first auth's late answer lands on a query
    // nothing reads any more, never on the one the second auth filled.
    const slow = deferred<Session | null>();
    const { rerender } = render(
      <AuthProvider auth={authOf({ getSession: () => slow.promise })}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );

    rerender(
      <AuthProvider auth={authOf({ getSession: async () => sessionOf("u-second") })}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(probe()).toBe("authenticated:u-second"));

    await act(async () => slow.resolve(sessionOf("u-first")));
    expect(probe()).toBe("authenticated:u-second");
  });

  it("unsubscribes on unmount, and drops an answer that arrives afterwards", async () => {
    const unsubscribe = vi.fn();
    const slow = deferred<Session | null>();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});

    const { unmount } = render(
      <AuthProvider auth={authOf({ getSession: () => slow.promise, subscribe: () => unsubscribe })}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );
    unmount();
    await act(async () => slow.resolve(sessionOf("u-7")));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    // What this cannot prove: React 19 no longer warns about a state update on an unmounted tree,
    // so the console is quiet either way. The claim that carries weight is the one above.
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("reads on the host's client, and throws without one", async () => {
    const client = new QueryClient();
    const auth = authOf({ getSession: async () => sessionOf("u-7") });
    render(
      <QueryClientProvider client={client}>
        <AuthProvider auth={auth}>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(probe()).toBe("authenticated:u-7"));
    // The session is the host's to see in its devtools and to clear on sign-out.
    expect(client.getQueryCache().getAll().map((query) => query.state.data)).toEqual([sessionOf("u-7")]);

    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<AuthProvider auth={auth} />)).toThrow(/No QueryClient set/);
    errors.mockRestore();
  });

  it("reads the session again when the tab becomes visible", async () => {
    // Auth.js's `refetchOnWindowFocus`: a tab left in the background comes back to the session the
    // others renewed or ended, not to the one it read when it loaded.
    let reads = 0;
    render(
      <AuthProvider auth={authOf({ getSession: async () => sessionOf(`u-${++reads}`) })}>
        <Probe />
      </AuthProvider>,
      { wrapper: Queries },
    );
    await waitFor(() => expect(probe()).toBe("authenticated:u-1"));

    try {
      act(() => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      });
      await waitFor(() => expect(probe()).toBe("authenticated:u-2"));
    } finally {
      focusManager.setFocused(undefined);
    }
  });
});
