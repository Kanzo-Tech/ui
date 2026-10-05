import { NextResponse, type NextRequest } from "next/server";
import { URL_HEADER, type Bound } from "./next-bound";
import { outage } from "./next-routes";
import type { Ended, Token } from "./server";
import { AuthError } from "./types";

/**
 * The proxy as the session authority: WorkOS AuthKit's `authkitProxy`, which renews and enforces
 * where the URL is known, over a Duende-style session that is updated in place.
 *
 * Next 16 runs `proxy.ts` on Node and only on Node, so the edge's reason for checking a cookie's
 * mere presence is gone. This reads the record — one store read per request — and acts on it
 * before any page renders:
 *
 * - **A live session within a minute of expiry is renewed.** Under a ticket store the tokens are
 *   rewritten under the same ticket and the cookie does not change. Under the stateless store the
 *   re-sealed cookie is set with `response.cookies.set`, which Next also merges into this same
 *   request's `cookies()`, so the page renders with the session the browser will hold.
 * - **No live session** — none, forgotten by the store, or refused by the IdP, which is a realm
 *   whose SSO session went idle — **clears the cookie and asks for a sign-in.** A navigation is
 *   sent to `signin?returnTo=<path+search>`; anything else answers a bare 401, because a prefetch,
 *   a server action or an RSC fetch cannot follow a sign-in and must not start one. The Next
 *   router answers a 401 to its own fetch with a hard navigation, which comes back through here as
 *   a navigation.
 * - **A store that does not answer** sends a navigation to the problem page with its code; **an
 *   IdP that does not answer** is passed through untouched, because the session it could not renew
 *   is still the person's, and a page that renders is better than a sign-in that cannot finish.
 *
 * ## Navigation or not, by Fetch Metadata
 *
 * `Sec-Fetch-Mode` (W3C Fetch Metadata) is set by the browser and cannot be set by script:
 * `navigate` is a document load, `cors`/`no-cors`/`same-origin` is everything else. Next strips its
 * own RSC headers before the proxy sees them, so this is the one signal that survives. An absent
 * header is a client that is not a browser, or one too old to send it, and is treated as a
 * navigation — a redirect it can follow is the more useful answer.
 *
 * ## The URL, forwarded
 *
 * Every request leaves with `x-kanzo-url` set to the URL it arrived at — AuthKit's `x-url` — and
 * with every incoming `x-kanzo-*` header deleted first, so a browser cannot choose what a server
 * component reads there. `session({ required: true })` signs in back to it, and the tenant
 * resolver reads the same URL the routes do.
 */

/** A path whose last segment carries a dot: a static file, not a page. */
function isFile(pathname: string): boolean {
  return pathname.slice(pathname.lastIndexOf("/") + 1).includes(".");
}

/** On a segment boundary, so `/health` opens `/health/live` and not `/healthcare`. */
function under(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * A `Set-Cookie` value as the attributes `response.cookies.set` takes, which is the call that makes
 * Next merge the cookie into this request's `cookies()`. A raw `Set-Cookie` header reaches the
 * browser and not the page being rendered.
 */
function asCookie(header: string) {
  const [pair = "", ...attributes] = header.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  const cookie: {
    name: string;
    value: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    maxAge?: number;
  } = { name: pair.slice(0, eq), value: pair.slice(eq + 1) };
  for (const attribute of attributes) {
    const [key = "", value = ""] = attribute.split("=");
    switch (key.toLowerCase()) {
      case "path":
        cookie.path = value;
        break;
      case "httponly":
        cookie.httpOnly = true;
        break;
      case "secure":
        cookie.secure = true;
        break;
      case "samesite":
        cookie.sameSite = value.toLowerCase() as "lax" | "strict" | "none";
        break;
      case "max-age":
        cookie.maxAge = Number(value);
        break;
    }
  }
  return cookie;
}

export async function gate(
  bound: Bound,
  request: NextRequest,
  extra?: HeadersInit,
): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  const forwarded = new Headers(request.headers);
  for (const name of [...forwarded.keys()]) {
    if (name.startsWith("x-kanzo-")) forwarded.delete(name);
  }
  forwarded.set(URL_HEADER, request.url);
  new Headers(extra).forEach((value, name) => forwarded.set(name, value));
  const through = () => NextResponse.next({ request: { headers: forwarded } });

  if (isFile(pathname) || under(pathname, bound.open)) return through();

  const mode = request.headers.get("sec-fetch-mode");
  const navigation = mode === null || mode === "navigate";

  let held: Token | Ended;
  try {
    held = await bound.party.token(request.headers.get("cookie"), { renewWithin: bound.renewWithin });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    if (error.code === "idp/unreachable" || error.code === "idp/silent") return through();
    if (!navigation) {
      return new NextResponse(null, {
        status: outage(error.code) ?? 500,
        headers: { "cache-control": "no-store" },
      });
    }
    const problem = new URL(bound.problemPage, request.url);
    problem.searchParams.set("code", error.code);
    return NextResponse.redirect(problem, 307);
  }

  if (held.ended) {
    let answer: NextResponse;
    if (navigation) {
      const signIn = new URL(`${bound.basePath}/signin`, request.url);
      // `routes` confines `returnTo` to this origin before sealing it; this relies on that check
      // rather than repeating it.
      signIn.searchParams.set("returnTo", `${pathname}${search}`);
      answer = NextResponse.redirect(signIn, 307);
    } else {
      answer = new NextResponse(null, { status: 401, headers: { "cache-control": "no-store" } });
    }
    for (const cookie of held.cookies) answer.headers.append("set-cookie", cookie);
    return answer;
  }

  const response = through();
  for (const cookie of held.cookies) response.cookies.set(asCookie(cookie));
  return response;
}
