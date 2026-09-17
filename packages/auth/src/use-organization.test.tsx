import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "./auth-provider";
import type { Auth, Session } from "./types";
import { useOrganization } from "./use-organization";

const session: Session = {
  user: { id: "u-7" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", id: "f8d3", roles: ["owner"] },
    { alias: "globex", id: "aa11", roles: ["member"] },
  ],
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

const realLocation = window.location;
function servedAt(hostname: string) {
  Object.defineProperty(window, "location", {
    value: { hostname, href: `https://${hostname}/` },
    configurable: true,
    writable: true,
  });
}
afterEach(() => {
  Object.defineProperty(window, "location", {
    value: realLocation,
    configurable: true,
    writable: true,
  });
});

function organization(alias?: string, auth: Auth = authOf()) {
  const { result } = renderHook(() => useOrganization(alias), {
    wrapper: ({ children }) => <AuthProvider auth={auth}>{children}</AuthProvider>,
  });
  return result;
}

describe("useOrganization derives the active organization instead of storing one", () => {
  it("resolves an alias given by the caller", async () => {
    const result = organization("globex");
    await waitFor(() => expect(result.current.organization?.alias).toBe("globex"));
    expect(result.current.organization?.roles).toEqual(["member"]);
    expect(result.current.isMember).toBe(true);
  });

  it("reads the hostname when no alias is given", async () => {
    servedAt("acme.kanzo.tech");
    const result = organization();
    await waitFor(() => expect(result.current.organization?.alias).toBe("acme"));
    expect(result.current.organization?.id).toBe("f8d3");
  });

  it("refuses a hostname the session does not back, and does not substitute another", async () => {
    // The invariant the whole package is arranged around: the host is chosen by whoever made the
    // request, and the token is what Keycloak signed. Falling back to the first membership here —
    // the convenient thing, since this person *is* a member of something — is how someone reads
    // another customer's data believing it is their own.
    servedAt("initech.kanzo.tech");
    const result = organization();

    await waitFor(() => expect(result.current.organizations).toHaveLength(2));
    expect(result.current.organization).toBeUndefined();
    expect(result.current.isMember).toBe(false);
  });

  it("refuses an alias the session does not back either, by the same rule", async () => {
    const result = organization("initech");
    await waitFor(() => expect(result.current.organizations).toHaveLength(2));
    expect(result.current.organization).toBeUndefined();
    expect(result.current.isMember).toBe(false);
  });

  it("finds no organization on a host that names none", async () => {
    servedAt("kanzo.tech");
    const result = organization();
    await waitFor(() => expect(result.current.organizations).toHaveLength(2));
    expect(result.current.organization).toBeUndefined();
    expect(result.current.isMember).toBe(false);
  });

  it("still reports the membership while the active organization is unresolved", async () => {
    // `organizations` is what a switcher draws, and it is the whole membership whatever the URL
    // says — which is what lets a person addressed at the wrong host be offered the right one.
    servedAt("initech.kanzo.tech");
    const result = organization();
    await waitFor(() =>
      expect(result.current.organizations.map((o) => o.alias)).toEqual(["acme", "globex"]),
    );
  });

  it("answers nothing, rather than throwing, before the session has arrived", async () => {
    servedAt("acme.kanzo.tech");
    const result = organization(undefined, authOf({ getSession: () => new Promise(() => {}) }));
    expect(result.current.organization).toBeUndefined();
    expect(result.current.organizations).toEqual([]);
    expect(result.current.isMember).toBe(false);
  });

  it("is anonymous-safe: no session is no membership", async () => {
    servedAt("acme.kanzo.tech");
    const result = organization(undefined, authOf({ getSession: async () => null }));
    await waitFor(() => expect(result.current.isMember).toBe(false));
    expect(result.current.organization).toBeUndefined();
    expect(result.current.organizations).toEqual([]);
  });
});
