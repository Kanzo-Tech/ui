import { describe, expect, it } from "vitest";
import { claims } from "./claims";
import { AuthError } from "./types";

/**
 * The claim vocabulary, as a specification.
 *
 * Every claim name asserted here is one Keycloak emits without being asked — `realm_access`,
 * `resource_access`, `organization`, and the OIDC standard set. None of them is ours. That is the
 * point of the file: an application that renames a claim buys a translation layer and loses this
 * one.
 */

const BOARD = { clientId: "board" } as const;

/** `{ alias: roles }`, which is the shape an assertion about memberships wants to read. */
function organizationsByAlias(session: { organizations: readonly { alias: string; roles: readonly string[] }[] }) {
  return Object.fromEntries(session.organizations.map((o) => [o.alias, [...o.roles]]));
}

describe("who the session names", () => {
  it("reads the subject, and refuses a claim set without one", () => {
    expect(claims({ sub: "u-1" }, BOARD).user.id).toBe("u-1");

    // Loud, unlike everything else here: no `sub` is not a session with less in it, it is a
    // configuration fault wearing a session's shape.
    expect(() => claims({ email: "a@b.example" }, BOARD)).toThrowError(AuthError);
    try {
      claims({}, BOARD);
    } catch (error) {
      expect((error as AuthError).code).toBe("claims/no-subject");
    }
  });

  it("falls back to the given and family names when `name` is absent", () => {
    expect(claims({ sub: "u", given_name: "Ada", family_name: "Lovelace" }, BOARD).user.name).toBe(
      "Ada Lovelace",
    );
    // A realm that maps only one half still yields something drawable.
    expect(claims({ sub: "u", given_name: "Ada" }, BOARD).user.name).toBe("Ada");
    expect(claims({ sub: "u" }, BOARD).user.name).toBeUndefined();
    // `name` wins when both are present.
    expect(claims({ sub: "u", name: "Ada L.", given_name: "Ada" }, BOARD).user.name).toBe("Ada L.");
  });
});

describe("roles, from the claims Keycloak already emits", () => {
  it("unions realm roles with this client's roles, and drops the duplicate", () => {
    const session = claims(
      {
        sub: "u",
        realm_access: { roles: ["default-roles", "owner"] },
        resource_access: { board: { roles: ["owner", "auditor"] } },
      },
      BOARD,
    );
    expect(session.roles).toEqual(["default-roles", "owner", "auditor"]);
  });

  it("ignores another client's roles entirely", () => {
    // The reason the union is keyed by clientId rather than flattened: `hub`'s admin is not
    // board's, and a token carries both.
    const session = claims(
      { sub: "u", resource_access: { board: { roles: ["member"] }, hub: { roles: ["admin"] } } },
      BOARD,
    );
    expect(session.roles).toEqual(["member"]);
  });

  it("is empty rather than broken when the claims are absent or malformed", () => {
    expect(claims({ sub: "u" }, BOARD).roles).toEqual([]);
    expect(claims({ sub: "u", realm_access: "nonsense" }, BOARD).roles).toEqual([]);
    expect(claims({ sub: "u", resource_access: { board: { roles: "nope" } } }, BOARD).roles).toEqual(
      [],
    );
    // Holding no roles is a legitimate state — a signed-in person who is nobody's member — so it
    // must not throw the way a missing subject does.
    expect(claims({ sub: "u", realm_access: { roles: [1, "owner", null] } }, BOARD).roles).toEqual([
      "owner",
    ]);
  });
});

describe("organizations", () => {
  it("reads each organization's id, and this application's roles inside it", () => {
    const session = claims(
      {
        sub: "u",
        organization: {
          acme: {
            id: "f8d3c4e1",
            groups: ["/Admins"],
            resource_access: { board: { roles: ["admin", "editor"] }, hub: { roles: ["reader"] } },
          },
          globex: { id: "aa11", resource_access: { board: { roles: ["reader"] } } },
        },
      },
      BOARD,
    );

    expect(session.organizations).toEqual([
      { alias: "acme", id: "f8d3c4e1", roles: ["admin", "editor"], groups: [], groupsOverage: false },
      { alias: "globex", id: "aa11", roles: ["reader"], groups: [], groupsOverage: false },
    ]);
  });

  it("reads the ids of the person's groups in each organization", () => {
    // The platform's mapper writes each organization's group ids under `groups`.
    const session = claims(
      {
        sub: "u",
        organization: {
          acme: { groups: ["g-admins", "g-research"], resource_access: { board: { roles: ["admin"] } } },
          globex: { groups: ["g-research-2"] },
        },
      },
      BOARD,
    );
    expect(
      session.organizations.map(({ alias, groups, groupsOverage }) => ({ alias, groups, groupsOverage })),
    ).toEqual([
      { alias: "acme", groups: ["g-admins", "g-research"], groupsOverage: false },
      { alias: "globex", groups: ["g-research-2"], groupsOverage: false },
    ]);
  });

  it("never reads a group's path as its id", () => {
    // Without the platform's mapper, Keycloak's own writes the groups' paths under the same key.
    // A path begins with `/` and an id never does, so that realm reads as no groups, not as names.
    expect(
      claims({ sub: "u", organization: { acme: { groups: ["/Admins", "/Research/ML"] } } }, BOARD)
        .organizations[0]?.groups,
    ).toEqual([]);
  });

  it("reads an overage as no ids, and says so", () => {
    // Entra ID's rule: past the threshold the entry carries `groups_overage` and no ids, and an
    // empty list then means "ask the directory", never "in no group". A list beside the flag would
    // be a partial one, and is not read.
    const [acme] = claims(
      { sub: "u", organization: { acme: { groups_overage: true, groups: ["g-1"] } } },
      BOARD,
    ).organizations;
    expect(acme).toMatchObject({ groups: [], groupsOverage: true });
  });

  it("keeps the group ids out of the roles", () => {
    const session = claims(
      { sub: "u", organization: { acme: { groups: ["g-1"], resource_access: { board: { roles: ["r"] } } } } },
      BOARD,
    );
    expect(session.roles).toEqual([]);
    expect(session.organizations).toEqual([
      { alias: "acme", id: undefined, roles: ["r"], groups: ["g-1"], groupsOverage: false },
    ]);
  });

  it("never reads a role from a group's name", () => {
    // Group names are the organization's own arrangement of its people. A group called "board"
    // or "/board/admin" grants nothing: only a role mapped onto the group does.
    expect(
      claims(
        { sub: "u", organization: { acme: { id: "a", groups: ["/board/admin", "/admin"] } } },
        BOARD,
      ).organizations,
    ).toEqual([{ alias: "acme", id: "a", roles: [], groups: [], groupsOverage: false }]);
  });

  it("reads a realm whose mapper emits the aliases alone", () => {
    // Membership without roles is still membership; losing it silently would log a member out of
    // their own organization on a realm nobody thought to check.
    expect(claims({ sub: "u", organization: ["acme"] }, BOARD).organizations).toEqual([
      { alias: "acme", roles: [], groups: [], groupsOverage: false },
    ]);
  });

  it("keeps an organization that grants this application nothing", () => {
    // Belonging with no role here is a real state — another application's member, or a member of
    // no group yet — and it is not the same as not belonging.
    expect(
      claims(
        { sub: "u", organization: { acme: { resource_access: { hub: { roles: ["reader"] } } } } },
        BOARD,
      ).organizations,
    ).toEqual([{ alias: "acme", id: undefined, roles: [], groups: [], groupsOverage: false }]);
  });

  it("does not merge an organization's roles into the session's own", () => {
    const session = claims(
      { sub: "u", organization: { acme: { resource_access: { board: { roles: ["admin"] } } } } },
      BOARD,
    );
    expect(session.roles).toEqual([]);
  });

  it("is empty for the single-tenant case, which costs that consumer nothing", () => {
    expect(claims({ sub: "u" }, { clientId: "viewer" }).organizations).toEqual([]);
  });
});

describe("expiry", () => {
  it("converts seconds to milliseconds", () => {
    expect(claims({ sub: "u", exp: 1_700_000_000 }, BOARD).expiresAt).toBe(1_700_000_000_000);
  });

  it("resolves an absent or unusable `exp` to zero, which reads as refresh now", () => {
    // Failing toward a refresh costs a round trip; failing the other way serves a dead session.
    expect(claims({ sub: "u" }, BOARD).expiresAt).toBe(0);
    expect(claims({ sub: "u", exp: "soon" }, BOARD).expiresAt).toBe(0);
    expect(claims({ sub: "u", exp: Number.POSITIVE_INFINITY }, BOARD).expiresAt).toBe(0);
  });
});

describe("a real token, taken off a live Keycloak 26.8.0", () => {
  // The access token `services/auth/scripts/verify.sh` received for the seeded `ana`: a member of
  // acme's "Admins" (mapped onto `high`, which contains `low`) and "Research", and of globex's
  // "Readers" (mapped onto `low`) and its own "Research", through the `kanzo-conformance` client,
  // which asks for group ids. The organization entries are as recorded on 2026-10-10, with the
  // platform's mapper in Keycloak; `sub` and the timestamps are left out.
  const token = {
    sub: "ana",
    aud: ["kanzo-conformance-api", "account"],
    azp: "kanzo-conformance",
    scope: "openid organization:* email profile",
    realm_access: { roles: ["offline_access", "uma_authorization", "default-roles-kanzo"] },
    resource_access: {
      account: { roles: ["manage-account", "manage-account-links", "view-profile"] },
    },
    organization: {
      globex: {
        id: "d46d7143-dae3-4413-8bcf-af2f6ebacac0",
        resource_access: { "kanzo-conformance": { roles: ["low"] } },
        groups: ["939de696-36e2-409e-ac53-67069335f42e", "4e2b3f51-0129-4d3e-8424-1f9b912348f1"],
      },
      acme: {
        id: "72af72cd-3d23-4970-b4c6-3b36a1dd2ed9",
        resource_access: { "kanzo-conformance": { roles: ["low", "high"] } },
        groups: ["b0865cd1-2af1-4ae8-b454-fbd5fbc6139a", "05cab159-8de1-4d4b-b086-79f6d3b2b64c"],
      },
    },
  };
  const session = claims(token, { clientId: "kanzo-conformance" });

  it("reads a composite with the role it contains, as Keycloak expanded it", () => {
    // Keycloak gives no order inside a role list, so the assertion sorts.
    const sorted = Object.fromEntries(
      Object.entries(organizationsByAlias(session)).map(([alias, roles]) => [alias, roles.sort()]),
    );
    expect(sorted).toEqual({ acme: ["high", "low"], globex: ["low"] });
  });

  it("keeps the organization's roles out of the session's own", () => {
    // Keycloak does not copy roles mapped onto organization groups into the top-level claim, and
    // the session must not either: a role in acme says nothing about globex.
    expect(session.roles).toEqual(["offline_access", "uma_authorization", "default-roles-kanzo"]);
  });

  it("carries the ids a host keys organizations by", () => {
    expect(session.organizations.map((o) => o.id)).toEqual([
      "d46d7143-dae3-4413-8bcf-af2f6ebacac0",
      "72af72cd-3d23-4970-b4c6-3b36a1dd2ed9",
    ]);
  });

  it("carries the ids of the groups held in each organization, two Researches apart", () => {
    // acme's "Research" and globex's are two groups with one name; a grant keyed by name would
    // reach across customers, and a grant keyed by id cannot.
    expect(Object.fromEntries(session.organizations.map((o) => [o.alias, o.groups]))).toEqual({
      globex: ["939de696-36e2-409e-ac53-67069335f42e", "4e2b3f51-0129-4d3e-8424-1f9b912348f1"],
      acme: ["b0865cd1-2af1-4ae8-b454-fbd5fbc6139a", "05cab159-8de1-4d4b-b086-79f6d3b2b64c"],
    });
  });
});
