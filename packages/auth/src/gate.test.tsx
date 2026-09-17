import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./auth-provider";
import { Gate } from "./gate";
import type { Auth, Session } from "./types";

const session: Session = {
  user: { id: "u-7" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", roles: ["owner"] },
    { alias: "globex", roles: ["member"] },
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

function gate(children: React.ReactNode, auth: Auth = authOf()) {
  return render(<AuthProvider auth={auth}>{children}</AuthProvider>);
}

describe("Gate draws one side or the other, and neither before it knows", () => {
  it("shows the children to someone who holds the role", async () => {
    gate(
      <Gate role="auditor" fallback={<span>no</span>}>
        <button type="button">Delete everything</button>
      </Gate>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeDefined());
    expect(screen.queryByText("no")).toBeNull();
  });

  it("shows the fallback to someone who does not", async () => {
    gate(
      <Gate role="owner" fallback={<span>no</span>}>
        <button type="button">Delete everything</button>
      </Gate>,
    );
    await waitFor(() => expect(screen.getByText("no")).toBeDefined());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing at all until the session has been read", async () => {
    // Both answers are unknown while the read is in flight, so neither is drawn. The fallback is
    // usually "you cannot do this", and showing that to someone who can — for as long as the
    // session endpoint takes — is a statement the application has no grounds for yet. Showing the
    // children instead is worse: a privileged control, flashed and then retracted.
    const { container } = gate(
      <Gate role="owner" fallback={<span>no</span>}>
        <button type="button">Delete everything</button>
      </Gate>,
      authOf({ getSession: () => new Promise(() => {}) }),
    );

    expect(container.textContent).toBe("");
    expect(screen.queryByText("no")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws nothing when there is no fallback and no role", async () => {
    const { container } = gate(
      <Gate role="owner">
        <button type="button">Delete everything</button>
      </Gate>,
    );
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    expect(container.textContent).toBe("");
  });

  it("asks inside the organization when one is named", async () => {
    gate(
      <Gate role="owner" organization="acme">
        <button type="button">Delete everything</button>
      </Gate>,
    );
    await waitFor(() => expect(screen.getByRole("button")).toBeDefined());
  });

  it("does not carry a role from one organization into another", async () => {
    // Owner of acme; the question is about globex, and the sets are never unioned. This is the
    // component-level face of the rule `can` enforces.
    gate(
      <Gate role="owner" organization="globex" fallback={<span>no</span>}>
        <button type="button">Delete everything</button>
      </Gate>,
    );
    await waitFor(() => expect(screen.getByText("no")).toBeDefined());
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the fallback to an anonymous visitor, not the children", async () => {
    gate(
      <Gate role="auditor" fallback={<span>no</span>}>
        <button type="button">Delete everything</button>
      </Gate>,
      authOf({ getSession: async () => null }),
    );
    await waitFor(() => expect(screen.getByText("no")).toBeDefined());
  });
});
