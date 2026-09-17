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

  it("has no hierarchy in it, so a product spells its own out", () => {
    // keasy's `owner ⊇ member` is a fact about keasy. Written at the call site it stays visible;
    // wired in here it would silently apply to every consumer, including the ones with three roles.
    const isMember = (org: string) => can(session, "owner", org) || can(session, "member", org);
    expect(isMember("acme")).toBe(true);
    expect(isMember("globex")).toBe(true);
    expect(isMember("initech")).toBe(false);
  });
});

describe("organizationOf", () => {
  it("finds by alias and is undefined for a non-membership", () => {
    expect(organizationOf(session, "acme")?.id).toBe("f8d3c4e1");
    expect(organizationOf(session, "initech")).toBeUndefined();
    expect(organizationOf(null, "acme")).toBeUndefined();
  });
});
