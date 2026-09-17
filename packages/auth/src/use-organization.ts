"use client";

import { useMemo } from "react";
import { organizationOf } from "./can";
import { organizationFromHost } from "./host";
import type { Organization } from "./types";
import { useSession } from "./use-session";

/**
 * Which organization this view is *in*, resolved per render rather than stored.
 *
 * The session says which organizations you belong to; the URL says which one you are looking at.
 * `Session` in `types.ts` carries why the second is never stored.
 *
 * `alias` names the organization explicitly; omitted, it is read from the hostname. A hostname
 * naming an organization this person does not belong to yields `organization: undefined` and
 * `isMember: false` — never a throw, and **never the first organization instead**. Falling back
 * is how someone ends up reading another customer's data believing it is their own.
 *
 * `isMember` answers about the *candidate*, so it is a different question from
 * `organizations.length > 0`: a product with one membership addressed at the wrong host is a member
 * of something and a member of nothing here.
 */
export function useOrganization(alias?: string): {
  readonly organization: Organization | undefined;
  readonly organizations: readonly Organization[];
  readonly isMember: boolean;
} {
  const { session } = useSession();

  return useMemo(() => {
    // Read at render, and undefined on a server. There is no hydration mismatch to manage: the
    // session itself arrives in the provider's effect, so the server render and the first client
    // render both resolve against `null` and agree whatever the hostname says.
    const candidate =
      alias ??
      (typeof window === "undefined" ? undefined : organizationFromHost(window.location.hostname));

    const organization = candidate === undefined ? undefined : organizationOf(session, candidate);

    return {
      organization,
      organizations: session?.organizations ?? [],
      isMember: organization !== undefined,
    };
  }, [alias, session]);
}
