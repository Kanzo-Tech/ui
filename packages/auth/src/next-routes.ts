import type { AuthSessionConfig } from "./next-session";
import { relyingParty, type RelyingParty } from "./server";
import { AuthError } from "./types";

/**
 * The four routes a Backend For Frontend needs, as one App Router catch-all.
 *
 * ```ts
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = authRoutes({ issuer, clientId, clientSecret, secret });
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
 * `next-session.ts` and `next-middleware.ts`, which genuinely cannot be written without `next`.
 *
 * ## The other end of the contract
 *
 * `bffAuth` in the root barrel is the browser half, and it is specific: it `GET`s
 * `${basePath}/session` and reads **401 as "nobody is signed in"**, not as a failure; it navigates
 * to `${basePath}/signin?returnTo=…&organization=…` and `${basePath}/signout?returnTo=…`. Those
 * four paths and that status code are the contract, and `next-routes.test.ts` drives a real
 * `bffAuth` against these handlers rather than trusting the two descriptions to agree.
 */

/** The session endpoint answers about a person; no cache may ever hold that answer. */
const PRIVATE = { "content-type": "application/json", "cache-control": "no-store" } as const;

export interface AuthRoutesConfig extends AuthSessionConfig {
  /**
   * Override the callback URL. Absent, it is derived from the incoming request: the origin it
   * arrived at, the path this route file sits on, and `/callback`.
   *
   * Deriving it trusts the `Host` header, which is chosen by whoever made the request. That is a
   * bounded trust — a forged host produces a `redirect_uri` Keycloak has not registered, and
   * Keycloak refuses it — but a deployment behind a proxy that rewrites the host should say the
   * URL out loud here rather than discover this.
   */
  readonly redirectUri?: string;
}

export interface AuthRouteHandlers {
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
    return undefined;
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

/**
 * An `AuthError` as a status and a code a product can route on.
 *
 * Anything else is rethrown: a failure this module has no reading of is Next's to report, and
 * flattening it into a 400 here would hide a misconfiguration behind a message about credentials.
 */
function failure(error: unknown): Response {
  if (!(error instanceof AuthError)) throw error;
  return new Response(JSON.stringify({ error: error.code, message: error.message }), {
    status: error.code === "session.absent" ? 401 : 400,
    headers: PRIVATE,
  });
}

export function authRoutes(config: AuthRoutesConfig): AuthRouteHandlers {
  // One instance, rebuilt only when the callback URL it was built for changes. A `Map` keyed by
  // origin would grow without bound on a stream of forged `Host` headers; a single slot cannot,
  // and it self-heals, because the next genuine request derives its own URL again. What it costs
  // in that case is a re-discovery, which is the right price for a request that lied.
  let current: { readonly redirectUri: string; readonly auth: RelyingParty } | undefined;
  const authFor = (redirectUri: string): RelyingParty => {
    if (current?.redirectUri !== redirectUri) {
      current = { redirectUri, auth: relyingParty({ ...config, redirectUri }) };
    }
    return current.auth;
  };

  const handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const { action, base } = split(url.pathname);
    const cookie = request.headers.get("cookie");
    const auth = authFor(config.redirectUri ?? `${url.origin}${base}/callback`);

    switch (action) {
      case "signin": {
        const started = await auth.begin({
          returnTo: sameOrigin(url.searchParams.get("returnTo"), url.origin) ?? "/",
          organization: url.searchParams.get("organization") ?? undefined,
        });
        return redirect(started.url, started.cookies);
      }

      case "callback": {
        try {
          const done = await auth.complete({ url, cookie });
          return redirect(done.returnTo, done.cookies);
        } catch (error) {
          return failure(error);
        }
      }

      case "signout": {
        const returnTo = sameOrigin(url.searchParams.get("returnTo"), url.origin);
        const ended = await auth.end(cookie, { returnTo });
        return redirect(ended.url, ended.cookies);
      }

      case "session": {
        const session = await auth.read(cookie);
        // 401 and no body at all. `bffAuth` reads this status as "nobody is signed in" and stops;
        // a body would be parsed by something eventually, and an error shape arriving where a
        // `Session` is expected is the failure `readSession` exists to refuse.
        if (session === null) {
          return new Response(null, { status: 401, headers: { "cache-control": "no-store" } });
        }
        return new Response(JSON.stringify(session), { status: 200, headers: PRIVATE });
      }

      default:
        return new Response(null, { status: 404 });
    }
  };

  // One handler behind both verbs. Every route here is reached by navigation or by `fetch`, and
  // which verb a product uses for sign-out — a link or a form — is its choice, not ours to
  // constrain with a second table that could drift from this one.
  return { GET: handle, POST: handle };
}
