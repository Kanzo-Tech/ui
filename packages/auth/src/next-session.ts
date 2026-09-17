import { cookies } from "next/headers";
import { cache } from "react";
import { relyingParty, type RelyingPartyConfig } from "./server";
import type { Session } from "./types";

/**
 * The session a React Server Component can read, without a request object in hand.
 *
 * An RSC is handed no `Request`; `next/headers` is how it reaches the one it is rendering for, and
 * that import is what makes this module — and only this module of the three — Node-only. It is
 * also what earns the whole door its place on a subpath: *a part belongs on a subpath only if it
 * imports that subpath's engine.*
 *
 * ## Why a factory, when the call site is `await getSession()`
 *
 * The call site is preserved exactly; what moved is where the binding is made. A
 * zero-argument import would have to find its secret somewhere ambient — an environment variable
 * this package would then be naming and documenting forever — and it could never be given a
 * {@link SessionStore}, which is an object and not a string. So the consumer binds it once, in the
 * same module that already holds the config it hands {@link authRoutes}:
 *
 * ```ts
 * // auth.ts
 * export const getSession = authSession({ issuer, clientId, clientSecret, secret });
 * ```
 *
 * and every server component writes `await getSession()`. That also makes the three names of this
 * door one shape — `authRoutes`, `authSession`, `authMiddleware` are all factories over a config —
 * rather than two factories and an exception.
 *
 * ## `cache`, and what it is for
 *
 * React's `cache` scopes memoization to one request, so a page that asks in a layout, in a
 * breadcrumb and in a menu unseals the cookie once. keasy's `web/src/lib/auth-check.ts` wraps its
 * own reader for exactly this reason. **It is dormant outside a React request scope** — `cache`
 * with no dispatcher simply calls through — which is why the test beside this file asserts the
 * answers and not the number of reads.
 */

/**
 * What reading a session needs, which is strictly less than signing one in.
 *
 * `redirectUri` is absent because no authorization request is built here: {@link RelyingParty.read}
 * unseals a cookie and asks the store, and neither of those has a browser to send anywhere.
 */
export type AuthSessionConfig = Omit<RelyingPartyConfig, "redirectUri">;

export function authSession(config: AuthSessionConfig): () => Promise<Session | null> {
  // The redirect URI is a required field of the confidential client and an unused one on this
  // path. Naming it here rather than making it optional on `RelyingPartyConfig` keeps the type that
  // signs people in honest: a sign-in without a redirect URI is a configuration error.
  const auth = relyingParty({ ...config, redirectUri: "" });

  return cache(async () => auth.read((await cookies()).toString()));
}
