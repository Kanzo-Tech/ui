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
 * Does this session hold `role`?
 *
 * With an `organization`, the question is asked *inside* it — the person's roles there, which is a
 * different set from their realm and client roles and is deliberately not merged with them. A role
 * held in one organization says nothing about another, and the day those two sets are unioned for
 * convenience is the day one organization's owner is every organization's owner.
 *
 * Closed by default: no session, or no membership of the named organization, is `false` rather than
 * an error. There is no hierarchy here either — that `owner` outranks `member` is a fact about a
 * product, so a product spells it out: `can(s, "owner", org) || can(s, "member", org)`.
 */
export function can(
  session: Session | null | undefined,
  role: string,
  organization?: string,
): boolean {
  if (!session) return false;
  if (organization === undefined) return session.roles.includes(role);
  return organizationOf(session, organization)?.roles.includes(role) ?? false;
}
