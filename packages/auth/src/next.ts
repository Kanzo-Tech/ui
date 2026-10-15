/**
 * `@kanzo-tech/auth/next` — an App Router application behind the platform's edge, as one object.
 *
 * ```ts
 * // lib/auth.ts
 * export const auth = kanzoAuth(async () => ({ issuer, clientId, jwks }));
 *
 * // proxy.ts
 * export const proxy = (request: NextRequest) => auth.proxy(request);
 *
 * // app/layout.tsx
 * <AuthProvider session={await auth.session()}>{children}</AuthProvider>
 * ```
 *
 * **One name.** The session a server component reads, the proxy and the resource-server forwarder
 * share one config and one session reader, and `kanzoAuth` is that. `can` on the root barrel is how
 * a server component asks about a role, exactly as `Gate` asks in the browser. There is no
 * `requireRole`: it would have added no new evaluation of a role, only a *throw*, and which throw —
 * `forbidden()`, a redirect, a rendered explanation — is a product's answer and not a library's.
 * `next.test.ts` holds the absence.
 *
 * ## This door must never reach React's client half
 *
 * The modules behind it import `./forwarded` and `./claims` directly and never `./index`, for the
 * reason `server.ts`'s own header gives. `next.test.ts` walks the relative imports from here.
 */

export { kanzoAuth, type KanzoAuth, type KanzoAuthConfig, type TenantRequest } from "./next-auth";
