import { relyingParty, type RelyingParty, type RelyingPartyConfig } from "./server";
import type { Session } from "./types";
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
   * Override the callback URL. Absent, it is derived from the request: its origin, the path the
   * routes sit on, and `/callback`. Deriving it trusts `Host`, which is bounded — Keycloak refuses
   * a `redirect_uri` it has not registered — but a deployment behind a proxy that rewrites the
   * host says the URL out loud here.
   */
  readonly redirectUri?: string;
  /** Seconds of access-token lifetime below which a request renews it. Default 60. */
  readonly renewWithin?: number;
  /**
   * Forward `mount` to a resource server at `target` with the access token as a bearer — the
   * token-mediating backend. The proxy leaves `mount` alone; `api` answers it.
   */
  readonly api?: { readonly mount: string; readonly target: string };
}

/** What a `kanzoAuth` instance is once its config has been read: one relying party and its settings. */
export interface Bound {
  readonly party: RelyingParty;
  readonly basePath: string;
  readonly problemPage: string;
  readonly redirectUri?: string;
  readonly renewWithin?: number;
  readonly api?: { readonly mount: string; readonly target: URL };
  /** Prefixes the proxy lets through: the routes, the forwarder, the problem page, and `public`. */
  readonly open: readonly string[];
  tenant(request: TenantRequest): Promise<string | undefined>;
}

/** The request header the proxy forwards the URL on — AuthKit's `x-url` — for a server component to read. */
export const URL_HEADER = "x-kanzo-url";


export function bind(config: KanzoAuthConfig): Bound {
  const basePath = withoutTrailingSlashes(config.basePath ?? "/api/auth");
  const problemPage = config.problemPage ?? "/auth/problem";
  const api =
    config.api === undefined
      ? undefined
      : { mount: withoutTrailingSlashes(config.api.mount), target: new URL(config.api.target) };
  const resolve = config.organization;
  return {
    party: relyingParty(config),
    basePath,
    problemPage,
    redirectUri: config.redirectUri,
    renewWithin: config.renewWithin,
    api,
    open: [basePath, problemPage, ...(api === undefined ? [] : [api.mount]), ...(config.public ?? [])].map(
      withoutTrailingSlashes,
    ),
    tenant: async (request) => (resolve === undefined ? undefined : resolve(request)),
  };
}

/** The current tenant on a session, when there is one. */
export function withTenant(session: Session, organization: string | undefined): Session {
  return organization === undefined ? session : { ...session, organization };
}

