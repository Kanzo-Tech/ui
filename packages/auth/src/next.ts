/**
 * `@kanzo-tech/auth/next` — the Backend For Frontend for an App Router product, as one object.
 *
 * ```ts
 * // lib/auth.ts
 * export const auth = kanzoAuth(async () => ({ issuer, clientId, clientSecret, secret, store }));
 *
 * // proxy.ts
 * export const proxy = (request: NextRequest) => auth.proxy(request);
 * export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
 *
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = auth.routes;
 * ```
 *
 * **One name.** The proxy, the routes, the resource-server forwarder and the server component's
 * session are four pieces of one relying party, and `kanzoAuth` is that relying party: one issuer,
 * one discovery cache, one store, one renewal per session. `can` on the root barrel is how a
 * server component asks about a role, exactly as `Gate` asks in the browser. There is no
 * `requireRole`: it would have added no new evaluation of a role, only a *throw*, and which throw —
 * `forbidden()`, a redirect, a rendered explanation — is a product's answer and not a library's.
 * `next.test.ts` holds the absence.
 *
 * ## This door must never reach React's client half
 *
 * The modules behind it import `./server` and `./claims` directly and never `./index`, for the
 * reason `server.ts`'s own header gives. `next.test.ts` walks the relative imports from here.
 */

export { kanzoAuth, type KanzoAuth, type KanzoAuthConfig } from "./next-auth";
