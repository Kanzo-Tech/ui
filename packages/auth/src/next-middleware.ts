import { NextResponse, type NextRequest } from "next/server";

/**
 * The edge middleware that sends an anonymous browser to the sign-in route.
 *
 * ```ts
 * // middleware.ts
 * export const middleware = authMiddleware({ public: ["/health"] });
 * ```
 *
 * ## It checks for presence, and nothing else
 *
 * The cookie is sealed with JWE, and this file never opens it — no key, no `jose`, no store. Two
 * reasons, and the second is the one that matters:
 *
 * 1. Middleware runs on every request, including the ones that are about to be answered from a
 *    cache. Decrypting there buys a redirect decision that a route handler and `authSession` are
 *    both going to make again, properly, a millisecond later.
 * 2. **A redirect is not an authorization.** Letting a request past here grants nothing: the page
 *    behind it reads the session itself, and the resource server behind *that* validates an access
 *    token. A forged cookie gets someone as far as a page that will find no session and say so.
 *    Treating this as the check is how a middleware becomes load-bearing and then gets edited by
 *    someone who does not know it is.
 *
 * So this module imports nothing from the package. That is deliberate and it has a cost: the
 * cookie's name is written here a second time, and `next-middleware.test.ts` ties the two together
 * by signing in through a fake realm and asserting the default is the name `relyingParty` actually
 * emitted. A transcribed constant with no test is how the number in a generated fixture goes stale.
 *
 * ## The matcher
 *
 * A `middleware.ts` also exports its own `config.matcher`, and keasy learned what belongs in it the
 * expensive way: a matcher that missed static files sent `/fossil/fossil_wasm_bg.wasm` to the
 * sign-in page, and the app loaded without its WebAssembly. The exemption is applied *here* as
 * well, on the path, so it holds whatever matcher a consumer writes — a fix for the class rather
 * than for the regexp. The matcher a product starts from:
 *
 * ```ts
 * export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"] };
 * ```
 */

/**
 * The cookie `relyingParty` issues: `sealedCookie` prefixes every name with `__Host-`.
 *
 * Held by "defaults to the cookie name relyingParty actually issues" in `next-middleware.test.ts`.
 */
const SESSION_COOKIE = "__Host-kanzo-session";

export interface AuthMiddlewareConfig {
  /**
   * Path prefixes that need no session — a health probe, a marketing page, a legal notice.
   *
   * Matched on segment boundaries, so `/health` exempts `/health` and `/health/live` and does
   * **not** exempt `/healthcare`. A plain `startsWith` is one keystroke away from opening a route
   * nobody meant to open.
   */
  readonly public?: readonly string[];
  /** Where `authRoutes` is mounted. Always public — it is how a person signs in. Default `/api/auth`. */
  readonly basePath?: string;
  /** Default `__Host-kanzo-session`. Set it only if `relyingParty` was given a different cookie. */
  readonly cookieName?: string;
}

/** A path whose last segment carries a dot: a static file, not a page. */
function isFile(pathname: string): boolean {
  return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
}

export function authMiddleware(
  config: AuthMiddlewareConfig = {},
): (request: NextRequest) => NextResponse {
  const base = (config.basePath ?? "/api/auth").replace(/\/$/, "");
  const cookieName = config.cookieName ?? SESSION_COOKIE;
  const open = [base, ...(config.public ?? [])].map((prefix) => prefix.replace(/\/$/, ""));

  return (request) => {
    const { pathname, search } = request.nextUrl;

    if (isFile(pathname)) return NextResponse.next();
    if (open.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
      return NextResponse.next();
    }
    if (request.cookies.has(cookieName)) return NextResponse.next();

    const away = new URL(`${base}/signin`, request.nextUrl);
    // Where they were going, so the callback can put them back. `authRoutes` confines it to this
    // origin before sealing it, which is the check this line is relying on rather than repeating.
    away.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(away);
  };
}
