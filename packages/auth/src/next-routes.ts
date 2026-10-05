import { tenantRequest, withTenant, type Bound } from "./next-bound";
import { isSameSite } from "./same-site";
import { AuthError, type AuthErrorCode, type Session } from "./types";

/**
 * The six routes a Backend For Frontend needs, as one App Router catch-all: `kanzoAuth().routes`.
 *
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = auth.routes;
 * ```
 *
 * `relyingParty` already does the whole flow in strings — a URL and a `Cookie` header in, a URL and
 * `Set-Cookie` values out — so the only thing written here is the translation into `Request` and
 * `Response`, plus the two decisions that translation forces: what a route answers when there is
 * no session, and where it is willing to send a browser afterwards.
 *
 * **Nothing in this module imports `next`.** An App Router route handler is handed a standard
 * `Request` and may answer with a standard `Response`, so the framework's own types would buy
 * nothing and would make this half untestable without it. The door earns its subpath through
 * `next-auth.ts` and `next-gate.ts`, which genuinely cannot be written without `next`.
 *
 * ## The other end of the contract
 *
 * `bffAuth` in the root barrel is the browser half, and it is specific: it `GET`s
 * `${basePath}/session` and reads **401 as "nobody is signed in"**, not as a failure; it `POST`s
 * `${basePath}/refresh` when a request of its own comes back 401, and retries that request once if
 * the renewal worked, and signs in once if it was refused; it navigates to
 * `${basePath}/signin?returnTo=…&organization=…` and `${basePath}/signout?returnTo=…`. Those paths
 * and those status codes are the contract, and `next-routes.test.ts` drives a real `bffAuth`
 * against these handlers rather than trusting the two descriptions to agree.
 *
 * ## A failure on a navigation is a page, not a body
 *
 * `signin`, `callback` and `signout` are reached by the browser's address bar, so an `AuthError`
 * there answers with a redirect to the product's `problemPage`, the code in `?code=`, where the
 * product renders it in its own words. `session` and `refresh` are reached by `fetch`, and answer
 * with a status and `{ error, message }`.
 *
 * ## Back-channel logout
 *
 * `backchannel-logout` is where Keycloak posts a logout token when a session ends at the IdP — an
 * administrator's sign-out, a session that expired there, a sign-out from another application —
 * per OpenID Connect Back-Channel Logout 1.0. It answers 200 once the sessions it names are
 * dropped, 400 for a token that does not verify, and 501 when the store cannot end a session from
 * the server (`session/irrevocable`): the specification's answers, so Keycloak's admin console
 * reports the failure rather than believing a logout happened.
 *
 * ## Which routes a cross-site request may reach
 *
 * `callback` and `signin` must be reachable from anywhere — one *is* a navigation from the
 * identity provider, and the other is a link somebody is allowed to put on another page — and so
 * must `backchannel-logout`, which is a server's POST, not a page's, and is authenticated by the
 * signature on the token it carries. The other three are not: `signout` reached cross-site is a
 * logout anyone can cause, `refresh` is a rotation anyone can cause, and `session` is a person's
 * identity read from a page that is not ours. `same-site.ts` carries the check and the reason the
 * package rather than the product owes it.
 */

/** The session endpoint answers about a person; no cache may ever hold that answer. */
const PRIVATE = { "content-type": "application/json", "cache-control": "no-store" } as const;

export interface RouteHandlers {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
}

/** The last path segment, and everything before it. `/api/auth/signin` → `signin`, `/api/auth`. */
function split(pathname: string): { readonly action: string; readonly base: string } {
  const cut = pathname.lastIndexOf("/");
  return { action: pathname.slice(cut + 1), base: cut <= 0 ? "" : pathname.slice(0, cut) };
}

/**
 * A `returnTo` confined to this origin, or `undefined`.
 *
 * Without this the sign-in route is an open redirect: `?returnTo=https://evil.test` is carried
 * through the whole flow and spent on a browser that has just proved who it is, which is the most
 * valuable moment to hijack. The check is here, where the string arrives from a query parameter,
 * and deliberately *not* repeated on the callback — what comes back out at the callback was
 * sealed into a cookie by us, so re-checking it would only make it unclear which check is the
 * real one.
 */
function sameOrigin(candidate: string | null, origin: string): string | undefined {
  if (candidate === null || candidate.length === 0) return undefined;
  try {
    const target = new URL(candidate, origin);
    return target.origin === origin ? target.href : undefined;
  } catch {
    return undefined; // not a URL at all: dropped like a foreign one, and the sign-in goes to `/`
  }
}

/**
 * A redirect that can carry cookies.
 *
 * `Response.redirect()` cannot: its headers are immutable, and a callback that cannot set a cookie
 * is a sign-in that never completes. And `append`, never `set` — the callback answers with **two**
 * `Set-Cookie` values, the session it just issued and the transaction it just spent, and `set`
 * would silently keep only the last of them.
 */
function redirect(url: string, cookies: readonly string[]): Response {
  const headers = new Headers({ location: url, "cache-control": "no-store" });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

/** No body, never cached: a status is the whole answer. */
function bare(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** The status for a party that did not answer, or `undefined` for a refusal. */
export function outage(code: AuthErrorCode): number | undefined {
  if (code === "idp/silent" || code === "session/silent") return 504;
  if (code === "idp/unreachable") return 502;
  if (code === "session/unavailable") return 503;
  return undefined;
}

/**
 * An `AuthError` as a status and a code a product can route on.
 *
 * Anything else is rethrown: a failure this module has no reading of is Next's to report, and
 * flattening it into a 400 here would hide a misconfiguration behind a message about credentials.
 */
function failure(error: unknown): Response {
  if (!(error instanceof AuthError)) throw error;
  return coded(error.code, error.message, outage(error.code) ?? 400);
}

function coded(code: AuthErrorCode, message: string, status: number, cookies: readonly string[] = []): Response {
  const headers = new Headers(PRIVATE);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ error: code, message }), { status, headers });
}

/** A request's cookies as a tenant resolver reads them, from the `Cookie` header a route is handed. */
export function routes(instance: () => Promise<Bound>): RouteHandlers {
  const handle = async (request: Request): Promise<Response> => {
    const bound = await instance();
    const url = new URL(request.url);
    const { action, base } = split(url.pathname);
    const cookie = request.headers.get("cookie");
    const auth = bound.party;
    const redirectUri = bound.redirectUri ?? `${url.origin}${base}/callback`;

    /** An `AuthError` on a navigation, as the product's page; anything else rethrown, as in `failure`. */
    const problem = (error: unknown): Response => {
      if (!(error instanceof AuthError)) throw error;
      const page = new URL(bound.problemPage, url.origin);
      page.searchParams.set("code", error.code);
      return redirect(page.href, []);
    };

    const crossable = action === "callback" || action === "signin" || action === "backchannel-logout";
    if (!crossable && !isSameSite(request)) return bare(403);

    switch (action) {
      case "signin": {
        try {
          const started = await auth.begin({
            redirectUri,
            returnTo: sameOrigin(url.searchParams.get("returnTo"), url.origin) ?? "/",
            organization: url.searchParams.get("organization") ?? undefined,
          });
          return redirect(started.url, started.cookies);
        } catch (error) {
          // `organization` arrives from a query parameter and `begin` refuses one that is not an
          // alias, because a space in it injects scopes; and the IdP may be down. Without this
          // `catch` either is a 500 on a link.
          return problem(error);
        }
      }

      case "callback": {
        try {
          const done = await auth.complete({ url, cookie, redirectUri });
          return redirect(done.returnTo, done.cookies);
        } catch (error) {
          return problem(error);
        }
      }

      case "signout": {
        const returnTo = sameOrigin(url.searchParams.get("returnTo"), url.origin);
        try {
          const ended = await auth.end(cookie, { returnTo });
          return redirect(ended.url, ended.cookies);
        } catch (error) {
          return problem(error);
        }
      }

      case "session": {
        let session: Session | null;
        try {
          session = await auth.read(cookie);
          if (session !== null) {
            session = withTenant(
              session,
              await bound.tenant(tenantRequest(request)),
            );
          }
        } catch (error) {
          return failure(error);
        }
        // 401 and no body at all. `bffAuth` reads this status as "nobody is signed in" and stops;
        // a body would be parsed by something eventually, and an error shape arriving where a
        // `Session` is expected is the failure `readSession` exists to refuse.
        if (session === null) return bare(401);
        return new Response(JSON.stringify(session), { status: 200, headers: PRIVATE });
      }

      case "refresh": {
        // `POST` only. The other routes are reached by navigation, where the verb is the browser's
        // to choose; this one spends a refresh token, and a `GET` that spends something is a link,
        // a prefetch and a preview pane away from spending it.
        if (request.method !== "POST") return bare(405, { allow: "POST" });
        try {
          const renewed = await auth.refresh(cookie);
          // An ended session is a 401 and the cookie cleared in the same answer, so the browser
          // stops presenting a ticket whose row is gone. An outage is a 5xx, which `bffAuth` does
          // not read as an ended session.
          if (renewed.ended) {
            return coded(renewed.code, "there is no session left to renew", 401, renewed.cookies);
          }
          const headers = new Headers(PRIVATE);
          for (const value of renewed.cookies) headers.append("set-cookie", value);
          return new Response(JSON.stringify(renewed.session), { status: 200, headers });
        } catch (error) {
          return failure(error);
        }
      }

      case "backchannel-logout": {
        if (request.method !== "POST") return bare(405, { allow: "POST" });
        // §2.5: `application/x-www-form-urlencoded`, one parameter.
        const token = new URLSearchParams(await request.text()).get("logout_token");
        if (token === null || token === "") return coded("token/refused", "no `logout_token`", 400);
        try {
          await auth.logout(token);
          return bare(200);
        } catch (error) {
          if (error instanceof AuthError && error.code === "session/irrevocable") {
            return coded(error.code, error.message, 501);
          }
          return failure(error);
        }
      }

      default:
        return new Response(null, { status: 404 });
    }
  };

  // One handler behind both verbs. Every route here is reached by navigation or by `fetch`, and
  // which verb a product uses for sign-out — a link or a form — is its choice, not ours to
  // constrain with a second table that could drift from this one. `refresh` and
  // `backchannel-logout` are the exceptions and check their own method.
  return { GET: handle, POST: handle };
}
