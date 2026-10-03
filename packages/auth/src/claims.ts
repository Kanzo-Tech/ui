import { AuthError, type Organization, type Session } from "./types";

/**
 * Keycloak's claim vocabulary, read into a {@link Session}. The only file in this package that
 * knows what Keycloak calls things.
 *
 * It is pure on purpose: claims in, session out, no network, no storage, no React. That is what
 * makes the vocabulary testable without a realm, and it is why every door can share one reading of
 * it instead of each parsing the token its own way.
 *
 * **Nothing here is invented.** Roles are `realm_access.roles` and `resource_access.<clientId>.roles`
 * — the claims Keycloak emits with no configuration — and membership is the `organization` claim
 * from the organization scope, which repeats `resource_access` inside each organization. A deployment that renames these has made work for itself; a
 * deployment that uses them gets this file for free.
 */

/** What the reader needs to know about the application doing the reading. */
export interface ClaimsConfig {
  /**
   * This application's Keycloak client id: the entry of `resource_access` that is ours, at the top
   * level and inside each organization.
   */
  readonly clientId: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * The `organization` claim, as a list.
 *
 * Canonically it is an object keyed by alias, and each entry carries what the person holds THERE:
 * `{ "acme": { "id": "…", "resource_access": { "board": { "roles": ["editor", "reader"] } } } }`.
 * Keycloak writes `resource_access` inside the entry from the role mappings of the person's
 * groups in that organization, composites expanded. Group names (`groups`) are the organization's
 * own data and are not read: an application learns its roles, never how an organization arranged
 * its people. A realm whose mapper includes neither the id nor the roles emits the aliases alone,
 * so both shapes are read — the alternative is a session that silently loses its memberships on a
 * realm nobody thought to check.
 */
function readOrganizations(claim: unknown, clientId: string): Organization[] {
  if (Array.isArray(claim)) {
    return claim
      .filter((alias): alias is string => typeof alias === "string")
      .map((alias) => ({ alias, roles: [] }));
  }

  const byAlias = asRecord(claim);
  if (byAlias === undefined) return [];

  return Object.entries(byAlias).map(([alias, value]) => {
    const body = asRecord(value);
    const roles = asStrings(asRecord(asRecord(body?.["resource_access"])?.[clientId])?.["roles"]);
    return { alias, id: asString(body?.["id"]), roles };
  });
}

/**
 * `given_name` + `family_name` when `name` is absent, which is how a realm without the profile
 * scope's full mapper set still yields something to draw.
 */
function readName(claims: Record<string, unknown>): string | undefined {
  const name = asString(claims["name"]);
  if (name !== undefined) return name;
  const parts = [asString(claims["given_name"]), asString(claims["family_name"])].filter(
    (p): p is string => p !== undefined,
  );
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Read a decoded claim set into a {@link Session}.
 *
 * Throws only for a claim set with no `sub`, which is not a session at all but a misconfiguration,
 * and is worth being loud about. Everything else degrades quietly to empty: holding no roles and
 * belonging to no organization are legitimate states, and a token that merely omits a scope must
 * not take the application down.
 *
 * The claims are **data, never instructions** — they came over the wire. Nothing here indexes into
 * the application on a claim's say-so; it reads known names and ignores the rest.
 */
export function claims(raw: unknown, config: ClaimsConfig): Session {
  const source = asRecord(raw) ?? {};

  const id = asString(source["sub"]);
  if (id === undefined) {
    throw new AuthError("claims/no-subject", "the claim set carries no `sub`, so it names nobody");
  }

  const realmRoles = asStrings(asRecord(source["realm_access"])?.["roles"]);
  const clientRoles = asStrings(
    asRecord(asRecord(source["resource_access"])?.[config.clientId])?.["roles"],
  );

  // `exp` is seconds in the token and milliseconds everywhere in JS. Absent, it resolves to 0 —
  // "refresh now" — which is the safe direction to fail: a client that refreshes early costs a
  // round trip, one that trusts an unknown expiry serves a dead session.
  const exp = source["exp"];
  const expiresAt = typeof exp === "number" && Number.isFinite(exp) ? exp * 1000 : 0;

  return {
    user: {
      id,
      email: asString(source["email"]),
      name: readName(source),
      username: asString(source["preferred_username"]),
    },
    roles: [...new Set([...realmRoles, ...clientRoles])],
    organizations: readOrganizations(source["organization"], config.clientId),
    expiresAt,
  };
}
