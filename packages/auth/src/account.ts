import type { Organization } from "./types";

/**
 * The pages of Keycloak's account console a product links to, by the route the console
 * (account-ui, Keycloak 26) declares: personal info at its root, the password and two-factor
 * methods, and the sessions on each device.
 */
export type AccountPage = "" | "account-security/signing-in" | "account-security/device-activity";

/**
 * Keycloak's account console for a realm — where a person changes their password, their sign-in
 * methods and their sessions, none of which a product should rebuild: `{issuer}/account`, and one of
 * its pages under it. `issuer` is the **public** issuer, the one the browser is sent to, as
 * `relyingParty` takes it.
 *
 * Pure, and on the root barrel, because a link is drawn wherever the session is — a server
 * component, a client menu — and needs no protocol to compute.
 */
export function accountUrl(issuer: string, page: AccountPage = ""): string {
  const root = `${issuer.replace(/\/+$/, "")}/account`;
  return page ? `${root}/${page}` : root;
}

/**
 * Keycloak's admin console at one organization's settings — where its members, domains and identity
 * providers are managed: `{origin}/admin/{realm}/console/#/{realm}/organizations/{id}/settings`, from
 * the public issuer `{origin}/realms/{realm}` and the organization's id, as `organizationOf(session,
 * alias)` returns it.
 *
 * `undefined` for an organization with no `id`, which a realm whose organization mapper leaves the
 * id out sends; there is no route to an organization by its alias. Whether a person may open the
 * console is the console's to decide — it authorises its own users — and a product shows the link to
 * those its `can` says manage the organization. Throws for an issuer that is not a Keycloak realm's,
 * which is a deployment's fault and not a condition to handle.
 */
export function organizationConsoleUrl(issuer: string, organization: Organization): string | undefined {
  // Split by string, not by a backtracking pattern: the issuer is configuration, and a regular
  // expression over it is one more thing a long run of slashes can slow down.
  let trimmed = issuer;
  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
  const at = trimmed.lastIndexOf("/realms/");
  const name = at === -1 ? "" : trimmed.slice(at + "/realms/".length);
  if (name === "" || name.includes("/")) {
    throw new Error(`${issuer} is not a Keycloak realm's issuer, \`{origin}/realms/{realm}\``);
  }
  if (organization.id === undefined) return undefined;
  const origin = trimmed.slice(0, at);
  return `${origin}/admin/${name}/console/#/${name}/organizations/${encodeURIComponent(organization.id)}/settings`;
}
