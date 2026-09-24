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
 * So: one interface, two implementations, and no catalogue. {@link statelessStore} is the cookie;
 * {@link ticketStore} is an opaque ticket over **a key-value adapter the deployment supplies**, so
 * plugging in Redis or a table is two functions rather than a reimplementation of the ticket. No
 * backend ships here — a driver is a dependency and a deployment decision, and neither is this
 * package's to make on its way past — but the *shape* does, because without it every product that
 * wants a real sign-out writes its own sealing, and a logout that invalidates nothing is the
 * thing they all ship instead.
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
  /**
   * The credential for a resource server, and the reason this field exists.
   *
   * Without it a token-mediating backend has nothing `typ: "Bearer"` to forward, and what it
   * reaches for instead is the ID token — which works on a realm that happens to put the same
   * audience in both and stops working the day the resource server checks the type, as it should.
   * An ID token says *who signed in*; it was never a key to an API. It is also what
   * `/token/introspect` and `/revoke` take, neither of which is reachable holding the other one.
   */
  readonly accessToken?: string;
  /**
   * Epoch milliseconds, from the token response's `expires_in` rather than from opening the token.
   *
   * The access token is opaque to us by contract — it is the resource server's to read — so its
   * lifetime comes from the envelope it arrived in. {@link Session.expiresAt} is the *ID token's*
   * expiry and is a different number on a realm that gives the two different lifetimes; renewing
   * against the wrong one is how a request goes out with a credential that died a minute ago.
   */
  readonly accessTokenExpiresAt?: number;
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
 * not implementable on top of it. Give `relyingParty` a {@link ticketStore} when either matters.
 *
 * ## It does not fit a record that carries an access token, and the numbers are the argument
 *
 * A browser is only required to keep 4096 bytes of cookie. Sealed with the three tokens a
 * token-mediating backend holds, a realistic Keycloak record — two organizations, the roles that
 * come with them — measures **6407 bytes**, and it measured **4068** before the access token
 * joined it, which is 28 bytes of margin and not a design. `store.test.ts` holds both figures.
 *
 * So this store is for a product that reads identity and calls no resource server. The moment
 * there is an API to call, the cookie carries a ticket instead of the tokens — which is
 * {@link ticketStore}, and the sealing throws with the byte count rather than letting a browser
 * drop the cookie in silence.
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

/**
 * The two functions and a delete that a store needs from a deployment's own database.
 *
 * Keys and opaque strings, because that is the intersection of Redis, a SQL table, a KV namespace
 * and a file on disk — anything narrower would name one of them. The value is already serialized
 * and it is **not encrypted**: it lives inside the deployment's own trust boundary, and a key held
 * by the same process that reads the rows protects against a stolen dump and nothing else. Encrypt
 * the storage, not the row.
 */
export interface TicketAdapter {
  /** The value written under `key`, or `null` when it is unknown or has expired. */
  read(key: string): Promise<string | null>;
  /**
   * Write `value` under `key`, to be forgotten after `ttl` seconds.
   *
   * **Honouring `ttl` is the adapter's job**, because every store that could hold this already has
   * an expiry of its own — `EX` on Redis, a column and a sweep on SQL — and a timer here would be
   * one that dies with the process. An adapter that ignores it leaks rows; it does not leak
   * sessions, because the sealed cookie carrying the ticket expires on its own schedule.
   */
  write(key: string, value: string, ttl: number): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface TicketStoreConfig {
  /**
   * Seconds a record is kept. Default eight hours — **set it to the `maxAge` you gave
   * `relyingParty`**, which is the lifetime of the cookie that carries the ticket.
   */
  readonly ttl?: number;
}

/** Eight hours, the same working day `relyingParty` defaults its cookie to. */
const DEFAULT_TTL = 8 * 60 * 60;

/**
 * 256 bits from the CSPRNG, base64url. The ticket is a bearer credential in everything but name —
 * it is sealed in the cookie, and it still must not be guessable from another one.
 */
function opaqueTicket(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A store where the cookie carries an opaque ticket and the record lives in the deployment's own
 * database — which is what makes a sign-out a sign-out.
 *
 * ```ts
 * relyingParty({
 *   …,
 *   store: ticketStore({
 *     read: (key) => redis.get(key),
 *     write: (key, value, ttl) => redis.set(key, value, { EX: ttl }),
 *     delete: (key) => redis.del(key),
 *   }),
 * });
 * ```
 *
 * ## What this buys that the cookie cannot
 *
 * **`drop` deletes.** Under {@link statelessStore} the ticket is the record, so a copy of the
 * cookie taken before sign-out keeps working until it expires and *sign out everywhere* is not
 * expressible at all. Here the cookie is a name for a row, and deleting the row ends every copy of
 * the cookie at once, immediately.
 *
 * ## The key carries the subject, and that is deliberate
 *
 * A ticket is `<subject>:<random>`. The random half is the whole of the security — the subject is
 * not a secret and is not trusted on the way back in, because the record it names is read from the
 * row and never from the key. What the prefix buys is the one operation a flat random key makes
 * impossible: *every session belonging to this person*. `SCAN sub:*` or `DELETE … WHERE key LIKE
 * 'sub:%'` is then a query a deployment can write, and "sign out on every device" and "one live
 * session per person" — which `put` is the place for — stop being features this package has to
 * grow an API for.
 */
export function ticketStore(adapter: TicketAdapter, config: TicketStoreConfig = {}): SessionStore {
  const ttl = config.ttl ?? DEFAULT_TTL;

  return {
    async put(record) {
      // `encodeURIComponent` on the subject, not on the whole key: a `sub` is a uuid on every realm
      // anyone has seen, and on the one that makes it something with a colon in it the prefix must
      // still be the prefix. The random half needs no encoding — base64url is already key-safe.
      const ticket = `${encodeURIComponent(record.session.user.id)}:${opaqueTicket()}`;
      await adapter.write(ticket, JSON.stringify(record), ttl);
      return ticket;
    },

    async get(ticket) {
      const value = await adapter.read(ticket);
      if (value === null) return null;
      try {
        return JSON.parse(value) as SessionRecord;
      } catch {
        // A row that is not a record is a row somebody else wrote, or one written by a version
        // that shaped it differently. Either way it names nobody, which is what `null` says.
        return null;
      }
    },

    async drop(ticket) {
      await adapter.delete(ticket);
    },
  };
}
