// The Guild's session, with no identity provider behind it.
//
// Every auth example on the site hangs off this file, and what it builds is a **claim set** rather
// than a hand-written `Session`: `claims()` is the real reader — the one `browserAuth` runs over an
// ID token — so what these examples draw is what a token would actually produce, group-path
// filtering and all. A hand-written `Session` would agree with the pages by construction and could
// never disagree with the package.

import { type Auth, type Session, claims } from "@kanzo-tech/auth";
import { VIEWER } from "@/example/people";
import { HALLS, type HallId } from "@/example/world";

/**
 * This application's Keycloak client id: the quest board.
 *
 * It is what selects `resource_access.board` and what makes `/board/…` a group path of ours. The
 * Guild's other application is the ledger, and `/ledger/reader` below is there to be dropped.
 */
export const BOARD = "board";

/**
 * Where Ravenna holds a charter and what she is in each, written the way Keycloak writes group
 * membership — a path whose first segment is the application.
 *
 * She is a warden in her own hall and something smaller in the two she visits, which is the whole
 * demonstration: a role held in one organization says nothing about another.
 */
const GROUPS: Partial<Record<HallId, string[]>> = {
  amber: [`/${BOARD}/${VIEWER.role}`, "/ledger/reader"],
  salt: [`/${BOARD}/archivist`],
  nine: [`/${BOARD}/scout`],
};

/** The halls the session carries a membership of — two of the five are deliberately missing. */
export const CHARTERED = HALLS.filter((entry) => GROUPS[entry.id] !== undefined);

/**
 * The `organization` claim, keyed by alias, in the shape the organization scope emits.
 *
 * The ids are legible rather than uuids because nothing here stores one; a realm's are uuids, and
 * the id is the half to keep, since an alias can be renamed.
 */
const ORGANIZATION = Object.fromEntries(
  CHARTERED.map((entry) => [entry.id, { groups: GROUPS[entry.id], id: `hall-${entry.id}` }]),
);

/** The claim set, as it would arrive decoded off an ID token. */
export const GUILD_CLAIMS = {
  email: VIEWER.email,
  // An hour out. Nothing in these examples renews, so it is never reached — but a `Session` whose
  // `expiresAt` is already behind it would be a fixture arguing with its own page.
  exp: Math.floor(Date.now() / 1000) + 3600,
  name: VIEWER.name,
  organization: ORGANIZATION,
  preferred_username: VIEWER.handle,
  // Rank is a fact about the person rather than about a hall, so it is a realm role and lands in
  // `session.roles`. What she is *in* a hall lands on that hall.
  realm_access: { roles: [VIEWER.rank] },
  sub: VIEWER.id,
};

/** What the package makes of it. `/ledger/reader` is gone by the time this is a `Session`. */
export const GUILD_SESSION: Session = claims(GUILD_CLAIMS, { clientId: BOARD });

/**
 * The five members of `Auth`, with no protocol behind any of them.
 *
 * A product writes `browserAuth(…)` or `bffAuth(…)` here and never writes this. The Gatehouse
 * showcase's page says why an interface this small can be faked at all.
 */
export function guildAuth(initial: Session | null = GUILD_SESSION): Auth {
  let current = initial;
  const listeners = new Set<() => void>();
  const announce = () => {
    for (const listener of listeners) listener();
  };

  return {
    fetch: async () => new Response(null, { status: 204 }),

    async getSession() {
      return current;
    },

    async signIn() {
      current = GUILD_SESSION;
      announce();
    },

    async signOut() {
      current = null;
      announce();
    },

    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
