/**
 * Did this request come from us?
 *
 * The session cookie is `SameSite=Lax`, and that is not a preference: `Strict` withholds the
 * cookie on the top-level navigation *back* from the identity provider, so the callback arrives
 * without the transaction it needs and every sign-in fails. `cookie-session.ts` carries that
 * argument in full. **`Lax` is therefore a decision this package made on a consumer's behalf, and
 * what it costs is exactly one thing: a cross-site top-level navigation still sends the cookie.**
 * `<img src="https://app.example.test/api/auth/signout">` on any page anywhere signs the person
 * out; `…/refresh` fired the same way spends a refresh token on somebody else's schedule.
 *
 * So the compensation belongs here rather than in every product: the package that chose `Lax` is
 * the one that owes the check for what `Lax` lets through.
 *
 * ## Fetch Metadata first, `Origin` second, and then allow
 *
 * `Sec-Fetch-Site` is set by the browser and cannot be set by script, which makes it the one
 * header here that is worth trusting. Every browser that has shipped since 2023 sends it. When it
 * is absent the request came from something that is not a browser — curl, a server, a crawler — or
 * from a browser old enough not to have it, and the fallback is `Origin`, which browsers attach to
 * every unsafe request and which the same script cannot forge either.
 *
 * With neither, this answers `true`. That is the honest end of the ladder rather than a hole: a
 * request carrying no evidence of where it came from also carries no evidence that it came from a
 * *page*, and the attack being stopped is a page. Refusing there would refuse every server-to-server
 * call and every health probe, which is a real outage traded for no real attacker.
 */

/**
 * `same-origin` and `none` pass; `same-site` and `cross-site` do not.
 *
 * `none` is a person typing the URL or following a bookmark — user-initiated, which is the thing
 * being protected, not the thing being refused. `same-site` is a sibling subdomain, and it is
 * refused deliberately: the cookie is `__Host-` and therefore host-only, but host-only describes
 * where the cookie *lives*, not who may cause a request to it. Anything that can serve
 * `docs.example.test` could otherwise sign every reader of it out of `app.example.test`.
 */
const TRUSTED_SITES = new Set(["same-origin", "none"]);

export function isSameSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return TRUSTED_SITES.has(site);

  const origin = request.headers.get("origin");
  if (origin !== null) return origin === new URL(request.url).origin;

  return true;
}
