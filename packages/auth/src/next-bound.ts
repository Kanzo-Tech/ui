import { DEFAULT_PREFIX, withoutTrailingSlashes } from "./edge-url";
import { forwarded, type Forwarded, type SessionReaderConfig } from "./forwarded";
import type { Session } from "./types";

/**
 * A `kanzoAuth` config once read: one session reader, and the settings the proxy, a server
 * component and the forwarder share. In a module of its own so those can take it without importing
 * the door that builds them.
 */

/**
 * What a tenant resolver — `KanzoAuthConfig.organization` — is handed: the URL the browser
 * addressed, its headers and its cookies. A server component builds it from the `x-kanzo-url` the
 * proxy forwarded and the forwarder from the request in front of it, so the same function answers
 * the same way in both.
 */
export interface TenantRequest {
  readonly url: URL;
  readonly headers: Headers;
  readonly cookies: { get(name: string): { readonly value: string } | undefined };
}

type Apis = Readonly<
  Record<string, { readonly target: string | ((organization: string | undefined) => string | undefined) }>
>;

/** What `kanzoAuth` is given: the session reader's config, and what the application adds to it. */
export interface KanzoAuthConfig extends SessionReaderConfig {
  /**
   * The organization a request addresses: a hostname's first label, a path segment, a cookie, or
   * one fixed alias for a deployment per tenant. Its answer is `Session.organization`, and the
   * organization `can` asks inside by default. Absent, sessions carry no current tenant.
   */
  readonly organization?: (request: TenantRequest) => string | undefined | Promise<string | undefined>;
  /** Where the edge's `sign_in` and `sign_out` live: oauth2-proxy's `OAUTH2_PROXY_PROXY_PREFIX`. Default `/api/auth`. */
  readonly prefix?: string;
  /**
   * The product's page for a forwarded token that did not verify, or keys that could not be fetched,
   * reached as `?code=<code>`. Default `/auth/problem`. Sending such a person to sign in instead is
   * a loop: the edge holds a session, and would forward the same token.
   */
  readonly problemPage?: string;
  /**
   * The Content-Security-Policy `proxy` sends, as directives to their sources. `proxy` draws a nonce
   * per request and adds `'nonce-…' 'strict-dynamic'` to `script-src` (the sources given here follow
   * them), on the request it forwards (the header Next reads to nonce its own scripts), on the
   * response, and as `x-nonce` for a server component that needs it. `'unsafe-inline'` in
   * `script-src` is refused when the config is read: an inline script on this origin is API access
   * (`/docs/design/auth-hardening`).
   */
  readonly csp?: Readonly<Record<string, readonly string[]>>;
  /**
   * The resource servers this application calls, by the path each is mounted on: a request under
   * the mount is forwarded to `target` with the forwarded access token as its bearer. The token
   * names the API in `aud` because the edge asked for the API's scope at sign-in.
   *
   * `target` may depend on the organization: one application in front of a resource server per
   * tenant, which is Keycloak's Organizations model — one client shared by every organization —
   * with the data still kept apart. `undefined` answers 404.
   */
  readonly apis?: Apis;
}

/** What a `kanzoAuth` instance is once its config has been read. */
export interface Bound {
  read(headers: Headers): Promise<Forwarded | null>;
  readonly prefix: string;
  readonly problemPage: string;
  /** The policy for one request's nonce, when `csp` was configured. */
  readonly csp?: (nonce: string) => string;
  /** Every mount, the longest first, so a request is forwarded by the most specific one. */
  readonly apis: readonly Api[];
  tenant(request: TenantRequest): Promise<string | undefined>;
}

/** One mounted resource server, once read. */
export interface Api {
  readonly mount: string;
  target(organization: string | undefined): URL | undefined;
}

/**
 * The URL the client addressed. Next builds `request.url` from the address the server listens on
 * rather than the one the client asked for — under `next dev` 16 a request for
 * `acme.localhost:3000` reads `http://localhost:3000` — so a deployment that answers on several
 * hosts would resolve every tenant to the same one. The authority is the edge's
 * `X-Forwarded-Host`, else `Host` (RFC 9110 §7.2); the scheme is `X-Forwarded-Proto`, else the
 * request's. Auth.js reads the same headers.
 */
export function addressedUrl(request: Request): URL {
  const url = new URL(request.url);
  const first = (name: string) => request.headers.get(name)?.split(",")[0]?.trim() || undefined;
  const host = first("x-forwarded-host") ?? first("host");
  const proto = first("x-forwarded-proto");
  const scheme = proto === "http" || proto === "https" ? `${proto}:` : url.protocol;
  // Rebuilt rather than assigned: `url.host = "acme.example.test"` keeps the listening port.
  try {
    return new URL(`${url.pathname}${url.search}`, `${scheme}//${host ?? url.host}`);
  } catch {
    return url;
  }
}

/** One cookie value out of a request's `Cookie` header, or `undefined`. */
function cookieValue(header: string | null, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

/** What a tenant resolver reads, from a request a route handler was given. */
export function tenantRequest(request: Request): TenantRequest {
  const header = request.headers.get("cookie");
  return {
    url: addressedUrl(request),
    headers: request.headers,
    cookies: {
      get(name: string) {
        const value = cookieValue(header, name);
        return value === undefined ? undefined : { value };
      },
    },
  };
}

/** On a segment boundary, so `/api/data` holds `/api/data/x` and not `/api/database`. */
export function under(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** The request header the proxy forwards the URL on — AuthKit's `x-url` — for a server component to read. */
export const URL_HEADER = "x-kanzo-url";

/** The header Next reads a CSP nonce from, and the one a server component reads it from. */
export const NONCE_HEADER = "x-nonce";

/** 128 random bits, base64: one per request, never reused. */
export function newNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/** `directives` with this request's nonce and `strict-dynamic` ahead of the host's own `script-src` sources. */
function policy(directives: Readonly<Record<string, readonly string[]>>): (nonce: string) => string {
  const scripts = directives["script-src"] ?? [];
  if (scripts.some((source) => source.toLowerCase() === "'unsafe-inline'")) {
    throw new Error("`csp` must not allow 'unsafe-inline' in script-src: the nonce is what admits a script");
  }
  return (nonce) =>
    Object.entries({ ...directives, "script-src": [`'nonce-${nonce}'`, "'strict-dynamic'", ...scripts] })
      .map(([name, sources]) => [name, ...sources].join(" "))
      .join("; ");
}

export function bind(config: KanzoAuthConfig): Bound {
  const apis: Api[] = Object.entries(config.apis ?? {})
    .map(([mount, api]) => ({
      mount: withoutTrailingSlashes(mount),
      target: (organization: string | undefined) => {
        const target = typeof api.target === "string" ? api.target : api.target(organization);
        return target === undefined ? undefined : new URL(target);
      },
    }))
    .sort((a, b) => b.mount.length - a.mount.length);
  const resolve = config.organization;
  return {
    read: forwarded(config),
    prefix: config.prefix ?? DEFAULT_PREFIX,
    problemPage: config.problemPage ?? "/auth/problem",
    csp: config.csp === undefined ? undefined : policy(config.csp),
    apis,
    tenant: async (request) => (resolve === undefined ? undefined : resolve(request)),
  };
}

/** The current tenant on a session, when there is one. */
export function withTenant(session: Session, organization: string | undefined): Session {
  return organization === undefined ? session : { ...session, organization };
}
