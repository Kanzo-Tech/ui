/**
 * The edge's own pages, as URLs: where a person signs in and signs out.
 *
 * oauth2-proxy serves both under the prefix the application gave it (`OAUTH2_PROXY_PROXY_PREFIX`,
 * `/api/auth` by default here): `sign_in`, which goes straight to Keycloak because the proxy skips
 * its own button, and `sign_out`, which ends the session in the proxy's store and at Keycloak. Both
 * come back to `rd`, a path on this origin or a host the proxy's whitelist names. Pure, with no
 * React and no engine, so the browser's hook and the server's redirect build the same URL.
 */

/** Where `AuthProvider` and `kanzoAuth` look for the edge's pages unless told otherwise. */
export const DEFAULT_PREFIX = "/api/auth";

/**
 * `path` without its trailing slashes, in one pass. A regex like `/\/+$/` backtracks on a long run
 * of slashes, and these strings come from configuration a library does not control.
 */
export function withoutTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") end--;
  return path.slice(0, end);
}

export function edgeUrl(prefix: string, page: "sign_in" | "sign_out", returnTo?: string): string {
  const base = withoutTrailingSlashes(prefix);
  return returnTo === undefined ? `${base}/${page}` : `${base}/${page}?rd=${encodeURIComponent(returnTo)}`;
}
