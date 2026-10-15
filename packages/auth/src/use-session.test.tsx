import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./auth-provider";
import type { Session } from "./types";
import { useSession } from "./use-session";

const session: Session = {
  user: { id: "u-7" },
  roles: ["auditor"],
  organizations: [{ alias: "acme", roles: ["owner"], groups: [], groupsOverage: false }],
  organization: "acme",
  expiresAt: 0,
};

function hook(as: Session | null, prefix?: string) {
  return renderHook(() => useSession(), {
    wrapper: ({ children }) => (
      <AuthProvider prefix={prefix} session={as}>
        {children}
      </AuthProvider>
    ),
  }).result.current;
}

describe("useSession", () => {
  it("hands every component the session the server read, and the role question asked here", () => {
    const value = hook(session);

    expect(value.session).toBe(session);
    expect(value.can("owner")).toBe(true);
    expect(value.can("owner", "globex")).toBe(false);
    expect(hook(null).can("auditor")).toBe(false);
  });

  /**
   * oauth2-proxy's own pages, under the prefix it was given: `sign_in` goes straight to Keycloak
   * and `sign_out` ends the session there too. `rd` is where each comes back to.
   */
  it("links to the edge's sign-in and sign-out under its prefix, coming back where asked", () => {
    const value = hook(null);

    expect(value.signInUrl()).toBe("/api/auth/sign_in");
    expect(value.signInUrl("/reports?q=a b")).toBe("/api/auth/sign_in?rd=%2Freports%3Fq%3Da%20b");
    expect(value.signOutUrl("/")).toBe("/api/auth/sign_out?rd=%2F");
    expect(hook(null, "/oauth2/").signOutUrl()).toBe("/oauth2/sign_out");
  });

  it("throws outside an AuthProvider, naming the fix", () => {
    function Bare() {
      useSession();
      return null;
    }
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Bare />)).toThrow(/outside <AuthProvider>/);
    } finally {
      console.error = quiet;
    }
  });
});
