import { describe, expect, it } from "vitest";
import { claims, roleFromGroupPath } from "./claims";
import { AuthError } from "./types";

/**
 * The claim vocabulary, as a specification.
 *
 * Every claim name asserted here is one Keycloak emits without being asked — `realm_access`,
 * `resource_access`, `organization`, and the OIDC standard set. None of them is ours. That is the
 * point of the file, and the last `describe` is the proof: the two claims keasy invented,
 * `keasy:role` and a `##`-joined `workspaces` string, carried nothing the standard set does not.
 */

const KEASY = { clientId: "keasy" } as const;

/** `{ alias: roles }`, which is the shape an assertion about memberships wants to read. */
function organizationsByAlias(session: { organizations: readonly { alias: string; roles: readonly string[] }[] }) {
  return Object.fromEntries(session.organizations.map((o) => [o.alias, [...o.roles]]));
}

describe("who the session names", () => {
  it("reads the subject, and refuses a claim set without one", () => {
    expect(claims({ sub: "u-1" }, KEASY).user.id).toBe("u-1");

    // Loud, unlike everything else here: no `sub` is not a session with less in it, it is a
    // configuration fault wearing a session's shape.
    expect(() => claims({ email: "a@b.example" }, KEASY)).toThrowError(AuthError);
    try {
      claims({}, KEASY);
    } catch (error) {
      expect((error as AuthError).code).toBe("claims.no-subject");
    }
  });

  it("falls back to the given and family names when `name` is absent", () => {
    expect(claims({ sub: "u", given_name: "Ada", family_name: "Lovelace" }, KEASY).user.name).toBe(
      "Ada Lovelace",
    );
    // A realm that maps only one half still yields something drawable.
    expect(claims({ sub: "u", given_name: "Ada" }, KEASY).user.name).toBe("Ada");
    expect(claims({ sub: "u" }, KEASY).user.name).toBeUndefined();
    // `name` wins when both are present.
    expect(claims({ sub: "u", name: "Ada L.", given_name: "Ada" }, KEASY).user.name).toBe("Ada L.");
  });
});

describe("roles, from the claims Keycloak already emits", () => {
  it("unions realm roles with this client's roles, and drops the duplicate", () => {
    const session = claims(
      {
        sub: "u",
        realm_access: { roles: ["default-roles", "owner"] },
        resource_access: { keasy: { roles: ["owner", "auditor"] } },
      },
      KEASY,
    );
    expect(session.roles).toEqual(["default-roles", "owner", "auditor"]);
  });

  it("ignores another client's roles entirely", () => {
    // The reason the union is keyed by clientId rather than flattened: `hub`'s admin is not
    // keasy's, and a token carries both.
    const session = claims(
      { sub: "u", resource_access: { keasy: { roles: ["member"] }, hub: { roles: ["admin"] } } },
      KEASY,
    );
    expect(session.roles).toEqual(["member"]);
  });

  it("is empty rather than broken when the claims are absent or malformed", () => {
    expect(claims({ sub: "u" }, KEASY).roles).toEqual([]);
    expect(claims({ sub: "u", realm_access: "nonsense" }, KEASY).roles).toEqual([]);
    expect(claims({ sub: "u", resource_access: { keasy: { roles: "nope" } } }, KEASY).roles).toEqual(
      [],
    );
    // Holding no roles is a legitimate state — a signed-in person who is nobody's member — so it
    // must not throw the way a missing subject does.
    expect(claims({ sub: "u", realm_access: { roles: [1, "owner", null] } }, KEASY).roles).toEqual([
      "owner",
    ]);
  });
});

describe("a group path is only this application's role", () => {
  it("takes the segment after the application", () => {
    expect(roleFromGroupPath("/keasy/owner", "keasy")).toBe("owner");
  });

  it("refuses another application's, which is the whole reason it filters", () => {
    // Without this, being a reader in the hub would make you a reader in keasy.
    expect(roleFromGroupPath("/hub/reader", "keasy")).toBeNull();
  });

  it("treats a single segment as granted everywhere", () => {
    expect(roleFromGroupPath("/owner", "keasy")).toBe("owner");
    expect(roleFromGroupPath("owner", "keasy")).toBe("owner");
  });

  it("keeps a nested path below the application rather than flattening it", () => {
    expect(roleFromGroupPath("/keasy/team/lead", "keasy")).toBe("team/lead");
  });

  it("is null for a path that is only separators", () => {
    expect(roleFromGroupPath("/", "keasy")).toBeNull();
    expect(roleFromGroupPath("", "keasy")).toBeNull();
  });
});

describe("organizations", () => {
  it("reads the canonical object, keyed by alias, with its id and roles", () => {
    const session = claims(
      {
        sub: "u",
        organization: {
          acme: { id: "f8d3c4e1", groups: ["/keasy/owner", "/hub/reader"] },
          globex: { id: "aa11", groups: ["/keasy/member"] },
        },
      },
      KEASY,
    );

    expect(session.organizations).toEqual([
      { alias: "acme", id: "f8d3c4e1", roles: ["owner"] },
      { alias: "globex", id: "aa11", roles: ["member"] },
    ]);
  });

  it("reads a realm whose mapper emits the aliases alone", () => {
    // Membership without roles is still membership; losing it silently would log a member out of
    // their own organization on a realm nobody thought to check.
    expect(claims({ sub: "u", organization: ["acme"] }, KEASY).organizations).toEqual([
      { alias: "acme", roles: [] },
    ]);
  });

  it("keeps an organization that grants this application nothing", () => {
    // Belonging with no role here is a real state — it is what a member of the hub looks like to
    // keasy — and it is not the same as not belonging, which is what the request extractor checks.
    expect(
      claims({ sub: "u", organization: { acme: { groups: ["/hub/reader"] } } }, KEASY)
        .organizations,
    ).toEqual([{ alias: "acme", id: undefined, roles: [] }]);
  });

  it("is empty for the single-tenant case, which costs that consumer nothing", () => {
    expect(claims({ sub: "u" }, { clientId: "woa-viewer" }).organizations).toEqual([]);
  });
});

describe("expiry", () => {
  it("converts seconds to milliseconds", () => {
    expect(claims({ sub: "u", exp: 1_700_000_000 }, KEASY).expiresAt).toBe(1_700_000_000_000);
  });

  it("resolves an absent or unusable `exp` to zero, which reads as refresh now", () => {
    // Failing toward a refresh costs a round trip; failing the other way serves a dead session.
    expect(claims({ sub: "u" }, KEASY).expiresAt).toBe(0);
    expect(claims({ sub: "u", exp: "soon" }, KEASY).expiresAt).toBe(0);
    expect(claims({ sub: "u", exp: Number.POSITIVE_INFINITY }, KEASY).expiresAt).toBe(0);
  });
});

describe("a real token, taken off a live Keycloak 26.6.4", () => {
  // Not a hand-written fixture. This is the access token an authorization-code + PKCE sign-in
  // actually returned for a seeded user belonging to two organizations, recorded when `kanzo-auth`
  // was first stood up. Everything above asserts what we believe the shape is; this asserts what it
  // was, and it is the only test here that would notice Keycloak changing its mind.
  const ACCESS_TOKEN_PAYLOAD = {
    iss: "http://localhost:8080/realms/kanzo",
    aud: ["keasy-api", "account"],
    typ: "Bearer",
    azp: "keasy",
    scope: "openid organization:* email profile",
    realm_access: { roles: ["offline_access", "uma_authorization", "default-roles-kanzo"] },
    resource_access: {
      account: { roles: ["manage-account", "manage-account-links", "view-profile"] },
    },
    organization: {
      globex: { id: "4ba7c7b1-27f1-4823-89e9-19e861ed433c", groups: ["/keasy/member"] },
      acme: {
        id: "a05d65ca-9fad-4b22-8b5a-a2068b718441",
        groups: ["/keasy/owner", "/vocab-browser/editor"],
      },
    },
    preferred_username: "ana",
    email: "ana@acme.test",
    name: "Ana Duarte",
    email_verified: true,
    sub: "ana-subject",
  };

  it("reads one person as an owner of one organization and a member of another", () => {
    const session = claims(ACCESS_TOKEN_PAYLOAD, KEASY);

    expect(session.user).toMatchObject({ name: "Ana Duarte", username: "ana" });
    expect(organizationsByAlias(session)).toEqual({ globex: ["member"], acme: ["owner"] });
  });

  it("does not let another application's role in, from inside the same organization", () => {
    // `acme` grants ana `/vocab-browser/editor` too, in the very same claim. keasy must not see it.
    // This is the filtering rule meeting a token that really carries two applications at once.
    const session = claims(ACCESS_TOKEN_PAYLOAD, KEASY);
    expect(session.organizations.flatMap((o) => o.roles)).not.toContain("editor");

    // And from the other side: the editor role is real, for the application it belongs to.
    const browser = claims(ACCESS_TOKEN_PAYLOAD, { clientId: "vocab-browser" });
    expect(organizationsByAlias(browser)).toEqual({ globex: [], acme: ["editor"] });
  });

  it("gives a single-tenant product an empty list, as that product's real token does", () => {
    // Measured beside it: a user belonging to no organization gets no `organization` claim at all,
    // because Keycloak drops `organization:*` from the granted scope. The viewer pays nothing.
    const viewer = {
      sub: "dan-subject",
      preferred_username: "dan",
      scope: "openid email profile",
      resource_access: { "woa-viewer": { roles: ["viewer", "operator"] } },
    };

    const session = claims(viewer, { clientId: "woa-viewer" });
    expect(session.organizations).toEqual([]);
    expect(session.roles).toEqual(["viewer", "operator"]);
  });
});

describe("the two claims keasy invented carried nothing new", () => {
  it("says in standard claims what `keasy:role` and a ##-joined `workspaces` said", () => {
    // Before: `keasy:role: ["owner"]` from a renamed client-role mapper, and
    // `workspaces: "acme##globex"` — a list packed into one string by a user-attribute mapper,
    // then split by hand. Both were ways to reach what the organization scope already publishes.
    const session = claims(
      {
        sub: "u-7",
        email: "ada@acme.example",
        organization: {
          acme: { id: "f8d3c4e1", groups: ["/keasy/owner"] },
          globex: { id: "aa11", groups: ["/keasy/member"] },
        },
      },
      KEASY,
    );

    expect(session.organizations.map((o) => o.alias)).toEqual(["acme", "globex"]);
    expect(session.organizations[0]?.roles).toEqual(["owner"]);
    expect(session.organizations[1]?.roles).toEqual(["member"]);

    // And the thing the old model could not say at all: the roles differ per organization. A
    // single effective role collapsed at login had one value for the whole session, so the same
    // person could not be an owner here and a member there.
    expect(session.organizations[0]?.roles).not.toEqual(session.organizations[1]?.roles);
  });
});
