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
 * from the organization scope. A deployment that renames these has made work for itself; a
 * deployment that uses them gets this file for free.
 */

/** What the reader needs to know about the application doing the reading. */
export interface ClaimsConfig {
  /**
   * This application's Keycloak client id. It selects two things: which entry of `resource_access`
   * is ours, and which organization groups are ours — see {@link roleFromGroupPath}.
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
 * A group path, as the role it grants *this* application — or `null` when it grants nothing here.
 *
 * Keycloak writes group membership as a path: `/keasy/owner`. Organization Groups (26.6) give each
 * organization its own hierarchy, so the convention this package reads is that **the first segment
 * is the application** when there is more than one:
 *
 * - `/keasy/owner` under client `keasy` → `owner`
 * - `/hub/reader` under client `keasy` → `null`, because it is another application's role
 * - `/owner` → `owner`, a role the organization grants across every application
 *
 * The filtering is not a nicety. Without it, a role granted to someone in the hub would authorise
 * them in keasy, which is the whole failure this separation exists to prevent.
 */
export function roleFromGroupPath(path: string, clientId: string): string | null {
  const segments = path.split("/").filter((s) => s.length > 0);
  const [first, ...rest] = segments;
  if (first === undefined) return null;
  if (rest.length === 0) return first;
  return first === clientId ? rest.join("/") : null;
}

/**
 * The `organization` claim, as a list.
 *
 * Canonically it is an object keyed by alias — `{ "acme": { "id": "…", "groups": ["/keasy/owner"] } }`
 * — because that is the shape that can carry the id and the groups. A realm whose mapper includes
 * neither emits the aliases alone, so both are read: the alternative is a session that silently
 * loses its memberships on a realm nobody thought to check.
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
    const roles = asStrings(body?.["groups"])
      .map((path) => roleFromGroupPath(path, clientId))
      .filter((role): role is string => role !== null);
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
    throw new AuthError("claims.no-subject", "the claim set carries no `sub`, so it names nobody");
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
