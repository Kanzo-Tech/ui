import type { Session } from "./types";

/**
 * Where the server keeps what it knows about a signed-in person.
 *
 * The default is a cookie and nothing else: the record is sealed into it, and the deployment needs
 * no database to hold a session. That is the right default and it is not sufficient for everyone —
 * keasy's `server/src/db/sessions.rs` enforces **one live session per user** and wants a sign-out
 * to take effect immediately, and a self-contained cookie can do neither. Both are the same
 * missing ability: a cookie already in someone's hands cannot be taken back.
 *
 * So: one interface, one default implementation, and no catalogue. A Redis or SQL store is three
 * methods a deployment writes; it is not a decision this package should be making on its way past.
 */

/**
 * What the server holds, and the browser never sees.
 *
 * The tokens are here rather than on {@link Session} because {@link Session} is the shape the
 * browser is given. Under the BFF pattern the whole point is that the refresh token stops at the
 * server, and a type that carried both would make the leak a typo away.
 */
export interface SessionRecord {
  readonly session: Session;
  /** Rotated on every use, per RFC 10017. The stored one is always the newest issued. */
  readonly refreshToken?: string;
  /** Kept for `id_token_hint` at the end-session endpoint; without it the IdP asks who is leaving. */
  readonly idToken?: string;
}

export interface SessionStore {
  /**
   * Store a record and return the ticket that identifies it.
   *
   * The ticket is what the cookie carries — sealed, so it never travels in the clear. **A store
   * that enforces one live session per person does it here**, by dropping that person's previous
   * ticket as it issues this one.
   */
  put(record: SessionRecord): Promise<string>;
  /** The record, or `null` when the ticket is unknown, expired, or has been revoked. */
  get(ticket: string): Promise<SessionRecord | null>;
  /** Forget it. Sign-out, and the immediate invalidation a self-contained cookie cannot do. */
  drop(ticket: string): Promise<void>;
}

/**
 * The default: no server state at all. The ticket *is* the record.
 *
 * What it cannot do, stated plainly rather than discovered later: **`drop` does nothing.** Signing
 * out clears the cookie, which is enough for the person holding the browser and is not enough for
 * anyone else — a copy of that cookie taken beforehand keeps working until it expires. A session
 * lifetime is therefore a real security parameter under this store, and "sign out everywhere" is
 * not implementable on top of it. Give `relyingParty` a store of your own when either matters.
 */
export function statelessStore(): SessionStore {
  return {
    async put(record) {
      return JSON.stringify(record);
    },
    async get(ticket) {
      try {
        return JSON.parse(ticket) as SessionRecord;
      } catch {
        return null;
      }
    },
    async drop() {
      /* Nothing to forget: see above, and mean it. */
    },
  };
}
