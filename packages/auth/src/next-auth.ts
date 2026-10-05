import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest, NextResponse } from "next/server";
import { cache } from "react";
import { bind, URL_HEADER, withTenant, type Bound, type KanzoAuthConfig } from "./next-bound";
import { gate } from "./next-gate";
import { forward, type ApiHandlers } from "./next-proxy";
import { routes, type RouteHandlers } from "./next-routes";
import { singleFlight } from "./single-flight";
import type { Session } from "./types";

export type { KanzoAuthConfig } from "./next-bound";

/**
 * `kanzoAuth` — the whole Backend For Frontend as one object: a proxy that is the session
 * authority, the auth routes, the resource-server forwarder and the session a server component
 * reads.
 *
 * ```ts
 * // lib/auth.ts
 * export const auth = kanzoAuth(async () => ({ issuer, clientId, clientSecret, secret, store }));
 *
 * // proxy.ts
 * export const proxy = (request: NextRequest) => auth.proxy(request);
 *
 * // app/api/auth/[...auth]/route.ts
 * export const { GET, POST } = auth.routes;
 *
 * // any server component
 * const session = await auth.session({ required: true });
 * ```
 *
 * ## One object, because one relying party
 *
 * Auth0's v4 SDK is one `Auth0Client` for the same reason. Every piece here talks to the same
 * issuer with the same secret and the same store, and a renewal in the proxy must be the renewal
 * the forwarder joins. Five factories each holding their own relying party meant five discovery
 * caches and five configs that had to agree by hand; one instance means they cannot disagree.
 *
 * ## Bound on first request, not at import
 *
 * `next build` imports every route module with no secrets in the environment, so the config is a
 * function — possibly async, for a secret read from a file or a vault — called the first time a
 * request needs it. The built instance is remembered; a failure is not, so a deployment that
 * started before its IdP or its secret was ready recovers on the next request instead of
 * remembering the outage. `routes` and `api` are plain handler objects that exist at import, which
 * is what a route file's `export const { GET, POST } = …` needs.
 */

export interface KanzoAuth {
  /**
   * Next's `proxy.ts`: the session authority for every page.
   *
   * It renews an access token that is about to expire, ends a session the IdP refused to renew,
   * and sends a browser with no live session to sign in carrying the URL it asked for — or, for a
   * request that is not a navigation, answers 401. `headers` are added to the request the page
   * sees, for a CSP nonce.
   */
  proxy(request: NextRequest, options?: { readonly headers?: HeadersInit }): Promise<NextResponse>;
  /** `signin`, `callback`, `signout`, `session`, `refresh` and `backchannel-logout`, for `[...auth]/route.ts`. */
  readonly routes: RouteHandlers;
  /** Every verb a route file exports, forwarding to `api.target`. 404 without `api`. */
  readonly api: ApiHandlers;
  /** The session this request carries, read once per request, or `null`. */
  session(): Promise<Session | null>;
  /** The session, or a redirect to sign in that comes back to this page. */
  session(options: { readonly required: true }): Promise<Session>;
}

/**
 * The URL a server component is rendering, from the header the proxy set — which it deletes from
 * every incoming request first, so a browser cannot choose it. A page the proxy does not run on
 * has only its host.
 */
function renderedUrl(incoming: Headers): URL {
  const forwarded = incoming.get(URL_HEADER);
  if (forwarded !== null) {
    try {
      return new URL(forwarded);
    } catch {
      /* not a URL: read as absent */
    }
  }
  return new URL(`https://${incoming.get("host") ?? "localhost"}/`);
}

export function kanzoAuth(
  config: KanzoAuthConfig | (() => KanzoAuthConfig | Promise<KanzoAuthConfig>),
): KanzoAuth {
  // The instance is kept and the attempt is not: concurrent first requests share one build, and a
  // build that threw leaves nothing behind, so the next request builds again — `issuer`'s shape.
  let bound: Bound | undefined;
  const build = singleFlight(async () => {
    bound = bind(typeof config === "function" ? await config() : config);
    return bound;
  });
  const instance = async (): Promise<Bound> => bound ?? build();

  // React's `cache` scopes the read to one server request, so a layout, a breadcrumb and a menu
  // asking in one render unseal the cookie and read the store once.
  const current = cache(async (): Promise<{ readonly session: Session | null; readonly url: URL }> => {
    const bound = await instance();
    const [jar, incoming] = await Promise.all([cookies(), headers()]);
    const url = renderedUrl(incoming);
    const found = await bound.party.read(jar.toString());
    if (found === null) return { session: null, url };
    return {
      session: withTenant(found, await bound.tenant({ url, headers: incoming, cookies: jar })),
      url,
    };
  });

  async function session(): Promise<Session | null>;
  async function session(options: { readonly required: true }): Promise<Session>;
  async function session(options?: { readonly required: true }): Promise<Session | null> {
    const { session: found, url } = await current();
    if (found !== null || options?.required !== true) return found;
    // AuthKit's `ensureSignedIn`: the proxy normally sends this browser to sign in before the page
    // renders, so this is the page the proxy does not run on, or a session that ended mid-render.
    const signIn = `${(await instance()).basePath}/signin`;
    redirect(`${signIn}?returnTo=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  return {
    proxy: async (request, options) => gate(await instance(), request, options?.headers),
    routes: routes(instance),
    api: forward(instance),
    session,
  };
}
