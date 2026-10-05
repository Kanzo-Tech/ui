import type { Organization, Session } from "./types";

/**
 * The role predicate, and the lookup underneath it.
 *
 * **What this decides is what to draw, never what to allow.** The roles a client holds are a copy,
 * and a copy is something an attacker controls the moment it reaches the browser: `can` hides a
 * button, and the resource server — validating the access token it was sent — is what actually
 * refuses the request behind it. A product that gates only here has not gated anything.
 */

/** The organization by that alias, or `undefined` for one this person does not belong to. */
export function organizationOf(
  session: Session | null | undefined,
  alias: string,
): Organization | undefined {
  return session?.organizations.find((org) => org.alias === alias);
}

/**
 * Does this session hold `role` — in the organization this request addresses, unless told which?
 *
 * The organization defaults to `session.organization`, the current tenant the product's resolver
 * named, so `can(session, "editor")` asks the question a page means: *here*. Clerk's
 * `auth().has()` binds to the active organization the same way. Named explicitly, the question is
 * asked inside that one instead. Inside an organization the answer comes from the person's roles
 * there, which is a different set from their realm and client roles and is deliberately not
 * merged with them: a role held in one organization says nothing about another, and the day those
 * two sets are unioned for convenience is the day one organization's owner is every
 * organization's owner. With no tenant at all, the realm and client roles answer.
 *
 * Closed by default: no session, or no membership of the organization, is `false` rather than an
 * error. There is no hierarchy here either: that `admin` contains `editor` is a fact about a
 * product, declared once as Keycloak composite roles where the product registers its client, and
 * the token carries the expanded set — so `can(s, "editor")` is true for an admin.
 */
export function can(
  session: Session | null | undefined,
  role: string,
  organization: string | undefined = session?.organization,
): boolean {
  if (!session) return false;
  if (organization === undefined) return session.roles.includes(role);
  return organizationOf(session, organization)?.roles.includes(role) ?? false;
}
