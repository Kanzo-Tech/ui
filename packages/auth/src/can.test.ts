import { describe, expect, it } from "vitest";
import { can, organizationOf } from "./can";
import type { Session } from "./types";

const session: Session = {
  user: { id: "u-7" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", id: "f8d3c4e1", roles: ["owner"] },
    { alias: "globex", id: "aa11", roles: ["member"] },
  ],
  expiresAt: 0,
};

describe("can", () => {
  it("answers on the global roles when no organization is named", () => {
    expect(can(session, "auditor")).toBe(true);
    expect(can(session, "owner")).toBe(false);
  });

  it("answers inside the organization when one is named", () => {
    expect(can(session, "owner", "acme")).toBe(true);
    expect(can(session, "member", "globex")).toBe(true);
  });

  it("does not carry a role from one organization into another", () => {
    // The failure this predicate exists to prevent. Owner of acme, member of globex — and the two
    // sets are never unioned, however convenient it would be at a call site.
    expect(can(session, "owner", "globex")).toBe(false);
    expect(can(session, "member", "acme")).toBe(false);
  });

  it("does not mix the global roles into an organization's, or the reverse", () => {
    // `auditor` is a realm role. Asking for it *inside* acme is a different question, and the
    // answer is no: a realm role authorises nothing organization-scoped by itself.
    expect(can(session, "auditor", "acme")).toBe(false);
    // And an organization role is not a global one.
    expect(can(session, "owner")).toBe(false);
  });

  it("is closed by default", () => {
    expect(can(null, "owner")).toBe(false);
    expect(can(undefined, "owner", "acme")).toBe(false);
    // Not a member at all is false, not an error: the request extractor is what refuses, loudly.
    expect(can(session, "owner", "initech")).toBe(false);
  });

  it("asks inside the current tenant when none is named", () => {
    const atAcme: Session = { ...session, organization: "acme" };

    expect(can(atAcme, "owner")).toBe(true);
    expect(can(atAcme, "auditor")).toBe(false);
    // Named explicitly, the question moves to that organization whatever the request addresses.
    expect(can(atAcme, "member", "globex")).toBe(true);
  });

  it("is closed for a current tenant the person does not belong to", () => {
    // The resolver answers an address, and an address is not a membership.
    expect(can({ ...session, organization: "initech" }, "owner")).toBe(false);
  });

  it("has no hierarchy in it: a role is held or it is not", () => {
    // A product's hierarchy is declared as composite roles and arrives expanded in the token, so
    // `can` only ever asks for presence. Ranking here would apply one product's order to every
    // consumer, including the ones with three roles.
    expect(can(session, "owner", "acme")).toBe(true);
    expect(can(session, "member", "acme")).toBe(false);
    expect(can(session, "member", "globex")).toBe(true);
  });
});

describe("organizationOf", () => {
  it("finds by alias and is undefined for a non-membership", () => {
    expect(organizationOf(session, "acme")?.id).toBe("f8d3c4e1");
    expect(organizationOf(session, "initech")).toBeUndefined();
    expect(organizationOf(null, "acme")).toBeUndefined();
  });
});
