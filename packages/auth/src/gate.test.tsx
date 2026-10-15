import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "./auth-provider";
import { Gate } from "./gate";
import type { Session } from "./types";

const session: Session = {
  user: { id: "u-7" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", roles: ["owner"], groups: [], groupsOverage: false },
    { alias: "globex", roles: ["member"], groups: [], groupsOverage: false },
  ],
  expiresAt: 0,
};

function gate(children: React.ReactNode, as: Session | null = session) {
  return render(<AuthProvider session={as}>{children}</AuthProvider>);
}

const control = <button type="button">Delete everything</button>;

/**
 * The session is the server's reading, handed down as a prop, so there is no moment when it is
 * not yet known and no read that can fail in the browser: `Gate` draws one side or the other on
 * the first render.
 */
describe("Gate draws one side or the other", () => {
  it("shows the children to someone who holds the role", () => {
    gate(<Gate role="auditor" fallback={<span>no</span>}>{control}</Gate>);
    expect(screen.getByRole("button")).toBeDefined();
    expect(screen.queryByText("no")).toBeNull();
  });

  it("shows the fallback to someone who does not", () => {
    gate(<Gate role="owner" fallback={<span>no</span>}>{control}</Gate>);
    expect(screen.getByText("no")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("draws nothing when there is no fallback and no role", () => {
    const { container } = gate(<Gate role="owner">{control}</Gate>);
    expect(container.textContent).toBe("");
  });

  it("asks inside the organization when one is named", () => {
    gate(<Gate role="owner" organization="acme">{control}</Gate>);
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("asks inside the current tenant when none is named", () => {
    gate(<Gate role="owner" fallback={<span>no</span>}>{control}</Gate>, { ...session, organization: "acme" });
    expect(screen.getByRole("button")).toBeDefined();
  });

  it("does not carry a role from one organization into another", () => {
    // Owner of acme; the question is about globex, and the sets are never unioned. This is the
    // component-level face of the rule `can` enforces.
    gate(<Gate role="owner" organization="globex" fallback={<span>no</span>}>{control}</Gate>);
    expect(screen.getByText("no")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the fallback to an anonymous visitor, not the children", () => {
    gate(<Gate role="auditor" fallback={<span>no</span>}>{control}</Gate>, null);
    expect(screen.getByText("no")).toBeDefined();
  });
});
