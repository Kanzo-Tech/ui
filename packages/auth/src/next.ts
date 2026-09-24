/**
 * `@kanzo-tech/auth/next` — the Backend For Frontend, in the files an App Router product already
 * has.
 *
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = authRoutes({ issuer, clientId, clientSecret, secret });
 *
 * // auth.ts
 * export const getSession = authSession({ issuer, clientId, clientSecret, secret });
 * export const getToken = authToken({ issuer, clientId, clientSecret, secret });
 *
 * // middleware.ts
 * export const middleware = authMiddleware({ public: ["/health"] });
 * ```
 *
 * **Not one config**: `authRoutes`, `authSession`, `authToken` and `authProxy` share the relying
 * party's, while `authMiddleware` takes neither a secret nor an issuer, because an edge middleware
 * only asks whether the cookie is *there*. Decrypting it at the edge would be the wrong place for
 * the work and a secret in the wrong runtime. `can` and `organizationOf` on the root barrel are
 * how a server component asks about a role, exactly as `Gate` asks in the browser. There is no
 * `requireRole` here: it would have added no new evaluation of a role, only a *throw*, and which
 * throw — `notFound()`, a redirect, a rendered explanation — is a product's answer and not a
 * library's. `next.test.ts` holds the absence.
 *
 * ## Who may be asked what, and why the signatures differ
 *
 * `authSession` reads `next/headers` and answers an identity; `authToken` is handed a `Cookie`
 * header and answers a credential *plus the cookies to set*. The asymmetry is not an oversight —
 * **a React Server Component cannot write cookies in Next**, and a renewal whose `Set-Cookie` is
 * dropped ends the session rather than merely failing, because the refresh token it spent is gone.
 * So the read-only one is the one an RSC can reach for, and the renewing one asks for something
 * only a route handler, a middleware or a server action has. `authProxy` is that pairing already
 * assembled: a route file that forwards to a resource server with the bearer token attached.
 *
 * ## This door must never reach React's client half
 *
 * The modules behind it import `./server` and `./claims` directly and never `./index`, for the
 * reason `server.ts`'s own header gives. `next.test.ts` walks the relative imports from here, and
 * `scripts/smoke-install.mjs` reads the built bytes.
 *
 * ## Why one barrel does not put `openid-client` on the edge
 *
 * `authMiddleware` runs in the edge runtime and must arrive with nothing behind it. It does:
 * `next-middleware.ts` imports only `next/server`, the package is `sideEffects: false`, and the
 * build writes one file per module (`preserveModules`), so a `middleware.ts` importing this barrel
 * is left holding that one module. They are kept in one file each for exactly this reason rather
 * than tidied together.
 */

export { authMiddleware, type AuthMiddlewareConfig } from "./next-middleware";
export { authProxy, type AuthProxyConfig, type AuthProxyHandlers } from "./next-proxy";
export { authRoutes, type AuthRouteHandlers, type AuthRoutesConfig } from "./next-routes";
export { authSession, type AuthSessionConfig } from "./next-session";
export { authToken } from "./next-token";
export type { Token } from "./server";
