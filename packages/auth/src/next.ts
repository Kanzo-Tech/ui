/**
 * `@kanzo-tech/auth/next` — the Backend For Frontend, in the three files an App Router product
 * already has.
 *
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = authRoutes({ issuer, clientId, clientSecret, secret });
 *
 * // auth.ts
 * export const getSession = authSession({ issuer, clientId, clientSecret, secret });
 *
 * // middleware.ts
 * export const middleware = authMiddleware({ public: ["/health"] });
 * ```
 *
 * Three names and no fourth concept — but **not one config**: `authRoutes` and `authSession` share
 * the relying party's, while `authMiddleware` takes neither a secret nor an issuer, because an edge
 * middleware only asks whether the cookie is *there*. Decrypting it at the edge would be the wrong
 * place for the work and a secret in the wrong runtime. `can` and `organizationOf` on the root
 * barrel are how a server component asks about a role, exactly as `Gate` asks in the browser.
 * There is no `requireRole` here: it would have added no new evaluation of a role, only a *throw*,
 * and which throw — `notFound()`, a redirect, a rendered explanation — is a product's answer and
 * not a library's. `next.test.ts` holds the absence.
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
 * is left holding that one module. The three are kept in three files for exactly this reason
 * rather than tidied into one.
 */

export { authMiddleware, type AuthMiddlewareConfig } from "./next-middleware";
export { authRoutes, type AuthRouteHandlers, type AuthRoutesConfig } from "./next-routes";
export { authSession, type AuthSessionConfig } from "./next-session";
