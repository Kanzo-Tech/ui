import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { cache } from "react";
import { isProblem } from "@kanzo-tech/problems";
import { edgeUrl } from "./edge-url";
import {
  addressedUrl,
  bind,
  newNonce,
  NONCE_HEADER,
  URL_HEADER,
  withTenant,
  type Bound,
  type KanzoAuthConfig,
} from "./next-bound";
import { forward, type ApiHandlers } from "./next-proxy";
import type { Session } from "./types";

export type { KanzoAuthConfig, TenantRequest } from "./next-bound";

/**
 * `kanzoAuth` — an App Router application behind the platform's edge, as one object: the session a
 * server component reads, the proxy that forwards the URL and the CSP nonce, and the forwarder to
 * the application's resource servers.
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
 *
 * // app/api/[...path]/route.ts
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = auth.api;
 * ```
 *
 * The session itself is the edge's: oauth2-proxy signs the person in, keeps and renews the session
 * and signs out, and forwards the access token, which this verifies on every read
 * (`./server`'s `sessionReader`). There is no route here, no cookie, no secret and no store.
 *
 * ## Bound on first request, not at import
 *
 * `next build` imports every module with no configuration in the environment, so the config is a
 * function — possibly async — called the first time a request needs it. The built instance is
 * remembered; a failure is not, so a deployment that started before its configuration was ready
 * recovers on the next request instead of remembering the fault.
 */
export interface KanzoAuth {
  /**
   * Next's `proxy.ts`. It forwards the URL the browser addressed as `x-kanzo-url`, deleting every
   * incoming `x-kanzo-*` header first, and with `csp` configured it draws a nonce per request and
   * sends the policy (`KanzoAuthConfig.csp`); a server component reads the nonce as `x-nonce` from
   * `headers()`. `headers` are added to the request the page sees. It decides nothing about the
   * session: the edge in front of it already has.
   */
  proxy(request: NextRequest, options?: { readonly headers?: HeadersInit }): Promise<NextResponse>;
  /** Every verb a route file exports, forwarding each mount of `apis` to its `target`. 404 without `apis`. */
  readonly api: ApiHandlers;
  /**
   * The person the forwarded token names, read once per request, with the tenant the resolver
   * names; `null` when the edge forwarded no token. Throws `token/refused` for a token that does not
   * verify, and `idp/silent` or `idp/unreachable` when the realm's keys could not be had.
   */
  session(): Promise<Session | null>;
  /**
   * The session, or a redirect: to the edge's sign-in, coming back to this page, when there is
   * none; to `problemPage` with the code when the token did not verify or could not be checked.
   */
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

async function proxy(bound: Bound, request: NextRequest, extra?: HeadersInit): Promise<NextResponse> {
  const forwarded = new Headers(request.headers);
  for (const name of [...forwarded.keys()]) {
    if (name.startsWith("x-kanzo-")) forwarded.delete(name);
  }
  forwarded.set(URL_HEADER, addressedUrl(request).href);
  // Never the browser's: whatever arrived as a nonce is deleted, and the one below is this request's.
  forwarded.delete(NONCE_HEADER);
  const nonce = bound.csp === undefined ? undefined : newNonce();
  const policy = nonce === undefined ? undefined : bound.csp?.(nonce);
  if (nonce !== undefined && policy !== undefined) {
    forwarded.set(NONCE_HEADER, nonce);
    forwarded.set("content-security-policy", policy);
  }
  new Headers(extra).forEach((value, name) => forwarded.set(name, value));
  const response = NextResponse.next({ request: { headers: forwarded } });
  if (policy !== undefined) response.headers.set("content-security-policy", policy);
  return response;
}

export function kanzoAuth(
  config: KanzoAuthConfig | (() => KanzoAuthConfig | Promise<KanzoAuthConfig>),
): KanzoAuth {
  // The instance is kept and the attempt is not: concurrent first requests share one build, and a
  // build that threw leaves nothing behind, so the next request builds again.
  let bound: Bound | undefined;
  let building: Promise<Bound> | undefined;
  const instance = (): Promise<Bound> => {
    if (bound !== undefined) return Promise.resolve(bound);
    if (building === undefined) {
      building = (async () => bind(typeof config === "function" ? await config() : config))()
        .then((built) => (bound = built))
        .finally(() => (building = undefined));
    }
    return building;
  };

  // React's `cache` scopes the read to one server request, so a layout, a breadcrumb and a menu
  // asking in one render verify the token once.
  const current = cache(async (): Promise<{ readonly session: Session | null; readonly url: URL }> => {
    const bound = await instance();
    const [jar, incoming] = await Promise.all([cookies(), headers()]);
    const url = renderedUrl(incoming);
    const found = await bound.read(incoming);
    if (found === null) return { session: null, url };
    return {
      session: withTenant(found.session, await bound.tenant({ url, headers: incoming, cookies: jar })),
      url,
    };
  });

  async function session(): Promise<Session | null>;
  async function session(options: { readonly required: true }): Promise<Session>;
  async function session(options?: { readonly required: true }): Promise<Session | null> {
    if (options?.required !== true) return (await current()).session;
    let read: Awaited<ReturnType<typeof current>>;
    try {
      read = await current();
    } catch (error) {
      if (!isProblem(error)) throw error;
      // AuthKit's `withAuth({ ensureSignedIn: true })` settles the outcome rather than handing the
      // page an exception; the code travels in the URL because a server error reaches the browser
      // stripped to a digest.
      const { problemPage } = await instance();
      const join = problemPage.includes("?") ? "&" : "?";
      redirect(`${problemPage}${join}code=${encodeURIComponent(error.code)}`);
    }
    const { session: found, url } = read;
    if (found !== null) return found;
    // The edge signs a browser in before the page renders, so this is a path the edge lets through
    // without a session, or an application reached without its edge.
    redirect(edgeUrl((await instance()).prefix, "sign_in", `${url.pathname}${url.search}`));
  }

  return {
    proxy: async (request, options) => proxy(await instance(), request, options?.headers),
    api: forward(instance),
    session,
  };
}
