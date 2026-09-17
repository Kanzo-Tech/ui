/**
 * The organization a hostname addresses — a **hint**, never an authority.
 *
 * This file has no `"use client"` and takes no globals, and both are deliberate: it is a string
 * function, so it is testable without a browser and readable on a server.
 *
 * The rule it must not be mistaken for: **the host is chosen by whoever made the request.** Anyone
 * can send `Host: acme.kanzo.tech`. What makes an organization real for a session is the
 * `organization` claim in a token Keycloak signed, so every consumer of this resolves the answer
 * against `session.organizations` and treats a miss as "not a member" — which is what
 * `useOrganization` does and what the server's own scope extractor must do before it opens a
 * database.
 */

/**
 * The leading label, when the hostname has one to spare.
 *
 * `acme.kanzo.tech` → `acme`, and `kanzo.tech` → `undefined`, because a two-label host is the site
 * itself rather than a tenant of it. `acme.localhost` → `acme` as the one exception, since that is
 * how a developer reaches a tenant without editing DNS. An IP address yields nothing.
 */
export function organizationFromHost(hostname: string | undefined): string | undefined {
  if (hostname === undefined || hostname.length === 0) return undefined;
  // An IPv4 literal or a bracketed IPv6 has no labels to read.
  if (/^\[|^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return undefined;

  const labels = hostname.split(".");
  const [first, second] = labels;
  if (first === undefined || first.length === 0) return undefined;

  if (labels.length >= 3) return first;
  if (labels.length === 2 && second === "localhost") return first;
  return undefined;
}
