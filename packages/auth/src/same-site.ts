import { addressedUrl } from "./next-bound";

/**
 * Did this request come from us?
 *
 * The edge's session cookie is `SameSite=Lax` (`services/auth`, `auth-proxy`), and that is not a
 * preference: `Strict` withholds the cookie on the top-level navigation *back* from Keycloak, so the
 * callback arrives without the session it needs and every sign-in fails. **What `Lax` costs is
 * exactly one thing: a cross-site top-level navigation still sends the cookie**, and the edge turns
 * that cookie into a token on every request it lets through. A link on any page anywhere to a
 * `GET` under `/api/…` would reach the forwarder carrying the person's token.
 *
 * So the check belongs to the application, not the edge: the edge authenticates the request, and
 * whether the page that caused it was ours is a question about the application's own endpoints.
 * RFC 10017 §6.1.3.3 requires a backend for frontend to defend itself, and `SameSite` alone is not
 * that defence where same-site neighbours exist.
 *
 * ## Fetch Metadata first, `Origin` second, and then refuse
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be set by script, which makes it the one
 * header here that is worth trusting. Every browser that has shipped since 2023 sends it. When it
 * is absent the request came from something that is not a browser — curl, a server, a crawler — or
 * from a browser old enough not to have it, and the fallback is `Origin`, which browsers attach to
 * every unsafe request and which the same script cannot forge either.
 *
 * With neither, this answers `false`. The OWASP CSRF Prevention Cheat Sheet says to treat the absence
 * as unknown and block it. Only the browser calls `/api/*` through the application, so there is no
 * option to let anything else in: a script, a probe or a test runner calls the API at its own origin
 * with its own credential (`/docs/design/auth-hardening`).
 */

/**
 * `same-origin` and `none` pass; `same-site` and `cross-site` do not.
 *
 * `none` is a person typing the URL or following a bookmark — user-initiated, which is the thing
 * being protected, not the thing being refused. `same-site` is a sibling subdomain, and it is
 * refused deliberately: the cookie is `__Host-` and therefore host-only, but host-only describes
 * where the cookie *lives*, not who may cause a request to it. Anything that can serve
 * `docs.example.test` could otherwise call `app.example.test`'s API as every reader of it.
 */
const TRUSTED_SITES = new Set(["same-origin", "none"]);

export function isSameSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return TRUSTED_SITES.has(site);

  const origin = request.headers.get("origin");
  if (origin !== null) return origin === addressedUrl(request).origin;

  return false;
}
