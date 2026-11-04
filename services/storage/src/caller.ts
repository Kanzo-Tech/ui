import { Problem } from "@kanzo-tech/kernel";

/**
 * The organization a deployment serves is the only one whose people may ask: a token of the same
 * realm naming another organization opens nothing here. Membership is the token's `organizations`,
 * as `@kanzo-tech/auth/server` read it; whether the person may open *this* path is the caller's.
 */
export function member(session: { readonly organizations: readonly { readonly alias: string }[] }, organization: string): void {
  if (!session.organizations.some((o) => o.alias === organization)) {
    throw new Problem("organization/denied", `the token names no membership of ${organization}`);
  }
}
