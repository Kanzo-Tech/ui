import type { AuthSessionConfig } from "./next-session";
import { relyingParty, type Token } from "./server";

/**
 * The access token a request carries, renewed when it is about to expire.
 *
 * ```ts
 * // auth.ts
 * export const getToken = authToken({ issuer, clientId, clientSecret, secret });
 *
 * // app/api/reports/route.ts
 * export async function GET(request: Request) {
 *   const held = await getToken(request.headers.get("cookie"));
 *   if (held === null) return new Response(null, { status: 401 });
 *
 *   const upstream = await fetch(REPORTS, {
 *     headers: { authorization: `Bearer ${held.accessToken}` },
 *   });
 *   const answer = new Response(upstream.body, upstream);
 *   for (const cookie of held.cookies) answer.headers.append("set-cookie", cookie);
 *   return answer;
 * }
 * ```
 *
 * This is the complement of {@link authSession}: that one answers *who*, this one answers *with
 * what*. Both are factories over the same config, for the reason `next-session.ts` gives.
 *
 * ## Why this exists at all, rather than a product reaching into the cookie
 *
 * Without it the only way to a bearer token is to rebuild the sealed cookie by hand — the same
 * name, the same `maxAge`, the same secret — and open it. That is this package's protocol,
 * reimplemented in a product, held together by nothing but two constants agreeing: change the
 * default cookie name or the default lifetime here and that product breaks in silence. A protocol
 * a consumer must re-derive is a protocol the package failed to expose.
 *
 * ## The cookie is an argument, and that is the API design
 *
 * There is no zero-argument form, and the absence is the point. **A React Server Component cannot
 * write cookies in Next**, and a renewal it dropped would not be a stale token — under the
 * rotation RFC 10017 requires, the refresh token this call spent is gone and the one it minted was
 * never persisted, so the session is over. A zero-argument form reading `next/headers` would work
 * in an RSC exactly well enough to destroy the session on the first renewal.
 *
 * So the signature asks for the `Cookie` header, which a **route handler**, a **middleware** and a
 * **server action** have and an RSC does not — and each of those can send the `Set-Cookie` that
 * comes back. An RSC that wants to know who is signed in calls {@link authSession}, which only
 * ever reads.
 *
 * ## Attaching `cookies` is not optional
 *
 * It is empty when nothing was renewed. When it is not empty it carries the only refresh token
 * still valid, and dropping it ends the session at the next renewal.
 */
export function authToken(
  config: AuthSessionConfig,
): (cookie: string | null | undefined, options?: { readonly renewWithin?: number }) => Promise<Token | null> {
  // The redirect URI is a required field of the confidential client and an unused one on this
  // path — no authorization request is built here — for the reason `next-session.ts` spells out.
  const auth = relyingParty({ ...config, redirectUri: "" });

  return (cookie, options) => auth.token(cookie, options);
}
