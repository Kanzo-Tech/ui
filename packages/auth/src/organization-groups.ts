import { deadline } from "./deadline";
import { keyedSingleFlight } from "./single-flight";
import { AuthError } from "./types";

/**
 * Where an application reads a person's groups when the token would not carry them all — Microsoft
 * Entra ID's overage, and its answer: the token says `groups_overage`, and the application asks the
 * directory. **This is a sketch an application owns**, not a door the package runs on its own: it
 * needs a credential the package never holds, an admin API client of the realm's, and the cache
 * that makes it affordable is the application's to size.
 *
 * The credential is a service account of the application's, holding `realm-management`'s
 * `view-organizations` **and** `view-users` — the member's groups endpoint answers 403 to either one
 * alone (measured on Keycloak 26.8.0).
 */
export interface OrganizationGroupsConfig {
  /** The realm's admin API, as this process reaches it: `http://keycloak:8080/admin/realms/kanzo`. */
  readonly adminUrl: string;
  /** A bearer for the service account above; called once per lookup, so cache it yourself. */
  readonly token: () => Promise<string>;
  /**
   * Whether each group's ancestors count, as the realm's mapper is configured (`inheritedGroups`,
   * default true). The two must agree, or a grant would hold over the token and not over this.
   */
  readonly inherited?: boolean;
  /**
   * Milliseconds an answer is reused. Default five minutes: the access token's own lifespan, so a
   * change of membership reaches an overage member no later than it reaches everyone else.
   */
  readonly ttl?: number;
  readonly fetch?: typeof globalThis.fetch;
}

/** The ids of `userId`'s groups in the organization `organizationId` — Keycloak's ids, both. */
export type OrganizationGroups = (organizationId: string, userId: string) => Promise<readonly string[]>;

interface GroupRepresentation {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string;
}

const DEFAULT_TTL = 5 * 60_000;

/**
 * The membership a token in overage leaves out, from `GET /organizations/{org}/members/{user}/groups`,
 * with each group's ancestors walked through `parentId` when `inherited` — stopping, as the mapper
 * does, at the organization's internal group, whose name is the organization's id.
 *
 * One request per key at a time, and an answer reused for `ttl`; a failure is not cached. Every
 * wait ends in 30 s as `idp/silent`; an answer that is not a 2xx is `idp/unreachable` with its
 * status.
 */
export function organizationGroups(config: OrganizationGroupsConfig): OrganizationGroups {
  const fetchImpl = config.fetch ?? globalThis.fetch;
  const ttl = config.ttl ?? DEFAULT_TTL;
  const inherited = config.inherited ?? true;
  const base = withoutTrailingSlashes(config.adminUrl);
  const cache = new Map<string, { readonly at: number; readonly ids: readonly string[] }>();
  const once = keyedSingleFlight<readonly string[]>();

  async function get<T>(path: string, bearer: string): Promise<T> {
    return deadline("idp/silent", async (signal) => {
      const response = await fetchImpl(`${base}${path}`, {
        headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw new AuthError("idp/unreachable", `the admin API answered ${response.status} to ${path}`, {
          status: response.status,
        });
      }
      return (await response.json()) as T;
    });
  }

  async function lookup(organizationId: string, userId: string): Promise<readonly string[]> {
    const bearer = await config.token();
    const org = `/organizations/${encodeURIComponent(organizationId)}`;
    const direct = await get<GroupRepresentation[]>(`${org}/members/${encodeURIComponent(userId)}/groups`, bearer);

    const ids = new Set<string>();
    for (const group of direct) {
      let current: GroupRepresentation | undefined = group;
      while (current !== undefined && current.name !== organizationId && !ids.has(current.id)) {
        ids.add(current.id);
        const parentId: string | undefined = current.parentId;
        current =
          inherited && parentId !== undefined
            ? await get<GroupRepresentation>(`${org}/groups/${encodeURIComponent(parentId)}`, bearer)
            : undefined;
      }
    }
    return [...ids];
  }

  return (organizationId, userId) => {
    const key = `${organizationId} ${userId}`;
    const hit = cache.get(key);
    if (hit !== undefined && Date.now() - hit.at < ttl) return Promise.resolve(hit.ids);
    return once(key, async () => {
      const ids = await lookup(organizationId, userId);
      const now = Date.now();
      // The cache holds the people seen within one ttl, and no one older.
      for (const [k, v] of cache) if (now - v.at >= ttl) cache.delete(k);
      cache.set(key, { at: now, ids });
      return ids;
    });
  };
}

/** `url` without its trailing slashes, in one pass: a regex like `/\/+$/` backtracks on a run of them. */
function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url.charCodeAt(end - 1) === 47) end--;
  return url.slice(0, end);
}
