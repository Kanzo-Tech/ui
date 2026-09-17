import { act, render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext } from "./auth-context";
import { AuthProvider } from "./auth-provider";
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
    );

    expect(probe()).toBe("loading:-");
    await act(async () => gate.resolve(sessionOf("u-7")));
    expect(probe()).toBe("authenticated:u-7");
  });

  it("settles on anonymous when there is no session", async () => {
    render(
      <AuthProvider auth={authOf({ getSession: async () => null })}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(probe()).toBe("anonymous:-"));
  });

  it("settles on anonymous when the read fails, rather than spinning forever", async () => {
    // A session that cannot be read is a session you do not have. Holding "loading" is a spinner
    // nobody can escape; anonymous sends the person to the IdP, which is recoverable.
    render(
      <AuthProvider auth={authOf({ getSession: async () => Promise.reject(new Error("offline")) })}>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(probe()).toBe("anonymous:-"));
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
    );
    await waitFor(() => expect(probe()).toBe("anonymous:-"));

    current = sessionOf("u-9");
    await act(async () => announce());
    expect(probe()).toBe("authenticated:u-9");
  });

  it("does not let a slow answer from a replaced auth overwrite the current one", async () => {
    // The teardown flag under test. `getSession` may be a cache read with nothing to abort, so
    // what stops a stale answer is the effect's own cleanup refusing to apply it — without that,
    // the first auth's late resolution lands on the state the second one already filled.
    const slow = deferred<Session | null>();
    const { rerender } = render(
      <AuthProvider auth={authOf({ getSession: () => slow.promise })}>
        <Probe />
      </AuthProvider>,
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
    );
    unmount();
    await act(async () => slow.resolve(sessionOf("u-7")));

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    // What this cannot prove: React 19 no longer warns about a state update on an unmounted tree,
    // so the console is quiet either way. The claim the flag really carries is the one above.
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
