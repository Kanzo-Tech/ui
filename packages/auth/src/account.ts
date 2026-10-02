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
 * `relyingParty` and `browserAuth` take it.
 *
 * Pure, and on the root barrel, because a link is drawn wherever the session is — a server
 * component, a SPA's menu — and needs no protocol to compute.
 */
export function accountUrl(issuer: string, page: AccountPage = ""): string {
  const root = `${issuer.replace(/\/+$/, "")}/account`;
  return page ? `${root}/${page}` : root;
}
