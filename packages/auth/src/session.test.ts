import { describe, expect, it } from "vitest";
import { claims } from "./claims";
import { readSession } from "./session";

const body = {
  user: { id: "u-7", email: "ada@example.com", name: "Ada", username: "ada" },
  roles: ["auditor"],
  organizations: [
    { alias: "acme", id: "f8d3", roles: ["owner"], groups: ["g-research"], groupsOverage: false },
    { alias: "globex", roles: [], groups: [], groupsOverage: true },
  ],
  organization: "acme",
  expiresAt: Date.UTC(2099, 0, 1),
};

describe("readSession checks the wire instead of casting it", () => {
  it("reads a well-formed body", () => {
    const session = readSession(body);
    expect(session?.user).toEqual({
      id: "u-7",
      email: "ada@example.com",
      name: "Ada",
      username: "ada",
    });
    expect(session?.roles).toEqual(["auditor"]);
    expect(session?.organizations).toEqual([
      { alias: "acme", id: "f8d3", roles: ["owner"], groups: ["g-research"], groupsOverage: false },
      { alias: "globex", id: undefined, roles: [], groups: [], groupsOverage: true },
    ]);
    expect(session?.organization).toBe("acme");
    expect(session?.expiresAt).toBe(Date.UTC(2099, 0, 1));
  });

  it("refuses anything that is not a session", () => {
    // A deploy skew or a proxy's error page is what actually arrives here. Cast, and it becomes a
    // `Session` whose `user` is undefined, failing three components away on a property read.
    expect(readSession("<!DOCTYPE html><title>502 Bad Gateway</title>")).toBeNull();
    expect(readSession(null)).toBeNull();
    expect(readSession([])).toBeNull();
    expect(readSession({})).toBeNull();
    expect(readSession({ user: null })).toBeNull();
    expect(readSession({ user: {} })).toBeNull();
    expect(readSession({ user: { id: "" } })).toBeNull();
    expect(readSession({ user: { id: 7 } })).toBeNull();
  });

  it("degrades the parts that are allowed to be missing", () => {
    // Holding no roles and belonging to nothing are legitimate states — monotenant is this shape.
    const session = readSession({ user: { id: "u-1" } });
    expect(session).toEqual({
      user: { id: "u-1", email: undefined, name: undefined, username: undefined },
      roles: [],
      organizations: [],
      organization: undefined,
      expiresAt: 0,
    });
  });

  it("drops the members of a list it cannot read, and keeps the rest", () => {
    const session = readSession({
      user: { id: "u-1" },
      roles: ["real", 7, null],
      organizations: [
        { alias: "acme", roles: ["owner", 3], groups: ["g-1", null] },
        { id: "no-alias" },
        "acme",
      ],
    });
    expect(session?.roles).toEqual(["real"]);
    expect(session?.organizations).toEqual([
      { alias: "acme", id: undefined, roles: ["owner"], groups: ["g-1"], groupsOverage: false },
    ]);
  });
});

describe("the one session reader", () => {
  /**
   * The server builds a session from claims and the browser reads one off the wire. A field
   * added to `Session` and dropped by either reader is a silent default; this is what fails
   * instead. It walks the session the way the session route sends it: `JSON.stringify`.
   */
  it("reads back what claims() built, field for field", () => {
    const built = claims(
      {
        sub: "u-7",
        email: "ada@example.com",
        given_name: "Ada",
        family_name: "Lovelace",
        preferred_username: "ada",
        exp: 4_070_908_800,
        realm_access: { roles: ["auditor"] },
        resource_access: { board: { roles: ["viewer"] } },
        organization: {
          acme: { id: "f8d3", groups: ["g-research", "/Wardens"], resource_access: { board: { roles: ["owner"] } } },
          globex: { id: "a1", groups_overage: true, groups: ["ignored"] },
          bare: {},
        },
      },
      { clientId: "board" },
    );
    // Every member of the type is a key, so a new one that the reader forgets shows up here as a gap.
    expect(Object.keys(built).sort()).toEqual(["expiresAt", "organization", "organizations", "roles", "user"]);
    expect(built.organizations.map((organization) => Object.keys(organization).sort())).toEqual(
      Array(3).fill(["alias", "groups", "groupsOverage", "id", "roles"]),
    );

    expect(readSession(JSON.parse(JSON.stringify(built)))).toEqual(built);
    // And with the tenant a route adds on top.
    const tenanted = { ...built, organization: "acme" };
    expect(readSession(JSON.parse(JSON.stringify(tenanted)))).toEqual(tenanted);
  });

  it("is what claims() ends in, so a claim set it cannot read is not a session", () => {
    expect(() => claims({ sub: "" }, { clientId: "board" })).toThrow(/no `sub`/);
  });
});
