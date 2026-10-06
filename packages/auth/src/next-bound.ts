import { DEFAULT_RENEW_WITHIN } from "./renew-within";
import { relyingParty, type RelyingParty, type RelyingPartyConfig } from "./server";
import type { Session } from "./types";
import { cookieValue } from "./cookie-session";
import { withoutTrailingSlashes } from "./issuer";

/**
 * A `kanzoAuth` config once read: one relying party, and the settings the proxy, the routes and
 * the forwarder share. In a module of its own so those three can take it without importing the
 * door that builds them.
 */

/**
 * What a tenant resolver is handed. The proxy, the routes and a server component each build it
 * from the request in front of them — a server component from the `x-kanzo-url` the proxy
 * forwarded — so the same function answers the same way in all three.
 */
type TenantRequest = {
  readonly url: URL;
  readonly headers: Headers;
  readonly cookies: { get(name: string): { readonly value: string } | undefined };
};

export interface KanzoAuthConfig extends RelyingPartyConfig {
  /**
   * The organization a request addresses: a hostname's first label, a path segment, a cookie, or
   * one fixed alias for a deployment per tenant. Its answer is `Session.organization`, and the
   * organization `can` asks inside by default. Absent, sessions carry no current tenant.
   */
  readonly organization?: (request: TenantRequest) => string | undefined | Promise<string | undefined>;
  /** Where `routes` is mounted. Default `/api/auth`. */
  readonly basePath?: string;
  /**
   * The product's page for a failed sign-in, callback or sign-out, and for a session store that
   * does not answer, reached as `?code=<AuthErrorCode>`. Default `/auth/problem`. Always public:
   * whoever is sent there has no session, and sending them to sign in instead is a loop when
   * signing in is what failed.
   */
  readonly problemPage?: string;
  /**
   * Path prefixes the proxy lets through without a session — a health probe, a legal notice.
   * Matched on segment boundaries: `/health` opens `/health/live` and not `/healthcare`.
   */
  readonly public?: readonly string[];
  /**
   * Override the callback URL. Absent, it is derived from the request: its `addressedUrl` origin,
   * the path the routes sit on, and `/callback`. Deriving it trusts `Host` and the proxy's
   * `X-Forwarded-*`, which is bounded — Keycloak refuses a `redirect_uri` it has not registered —
   * but a deployment whose proxy sets none of them says the URL out loud here.
   */
  readonly redirectUri?: string;
  /** Seconds of access-token lifetime below which a request renews it. Default 60. */
  readonly renewWithin?: number;
  /**
   * The resource servers this application calls, by the path each is mounted on: a request under
   * the mount is forwarded to `target` with a bearer token for `audience` and the organization the
   * request addresses — the token-mediating backend. The proxy leaves every mount alone; `api`
   * answers them, the longest mount first.
   *
   * `audience` is the API's client id in the realm (`services/auth/modules/api`), listed in the
   * application's `apis` there. `target` may depend on the organization: one BFF in front of a
   * resource server per tenant, which is Keycloak's Organizations model — one client shared by
   * every organization — with the data still kept apart. `undefined` answers 404.
   */
  readonly apis?: Readonly<
    Record<
      string,
      {
        readonly audience: string;
        readonly target: string | ((organization: string | undefined) => string | undefined);
      }
    >
  >;
}

/** What a `kanzoAuth` instance is once its config has been read: one relying party and its settings. */
export interface Bound {
  readonly party: RelyingParty;
  readonly basePath: string;
  readonly problemPage: string;
  readonly redirectUri?: string;
  readonly renewWithin: number;
  /** Every mount, the longest first, so a request is forwarded by the most specific one. */
  readonly apis: readonly Api[];
  /** Prefixes the proxy lets through: the routes, the forwarder, the problem page, and `public`. */
  readonly open: readonly string[];
  tenant(request: TenantRequest): Promise<string | undefined>;
}

/** One mounted resource server, once read. */
export interface Api {
  readonly mount: string;
  readonly audience: string;
  target(organization: string | undefined): URL | undefined;
}

/**
 * The URL the client addressed. Next builds `request.url` from the address the server listens on
 * rather than the one the client asked for — under `next dev` 16 a request for
 * `acme.localhost:3000` reads `http://localhost:3000` — so a deployment that answers on several
 * hosts would resolve every tenant, callback and redirect to the same one, and one behind a proxy
 * that terminates TLS would hand Keycloak an `http` callback. The authority is the proxy's
 * `X-Forwarded-Host`, else `Host` (RFC 9110 §7.2); the scheme is `X-Forwarded-Proto`, else the
 * request's. Auth.js reads the same headers. Trusting them is bounded the way `redirectUri` says:
 * Keycloak refuses a callback it has not registered.
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

/** On a segment boundary, so `/health` opens `/health/live` and not `/healthcare`. */
export function under(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** The request header the proxy forwards the URL on — AuthKit's `x-url` — for a server component to read. */
export const URL_HEADER = "x-kanzo-url";

export function bind(config: KanzoAuthConfig): Bound {
  const basePath = withoutTrailingSlashes(config.basePath ?? "/api/auth");
  const problemPage = config.problemPage ?? "/auth/problem";
  const apis: Api[] = Object.entries(config.apis ?? {})
    .map(([mount, api]) => ({
      mount: withoutTrailingSlashes(mount),
      audience: api.audience,
      target: (organization: string | undefined) => {
        const target = typeof api.target === "string" ? api.target : api.target(organization);
        return target === undefined ? undefined : new URL(target);
      },
    }))
    .sort((a, b) => b.mount.length - a.mount.length);
  const resolve = config.organization;
  return {
    party: relyingParty(config),
    basePath,
    problemPage,
    redirectUri: config.redirectUri,
    renewWithin: config.renewWithin ?? DEFAULT_RENEW_WITHIN,
    apis,
    open: [basePath, problemPage, ...apis.map((api) => api.mount), ...(config.public ?? [])].map(
      withoutTrailingSlashes,
    ),
    tenant: async (request) => (resolve === undefined ? undefined : resolve(request)),
  };
}

/** The current tenant on a session, when there is one. */
export function withTenant(session: Session, organization: string | undefined): Session {
  return organization === undefined ? session : { ...session, organization };
}

