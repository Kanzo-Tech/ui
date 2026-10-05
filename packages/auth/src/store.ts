import { deadline } from "./deadline";
import { AuthError, type Session } from "./types";

/**
 * Where the server keeps what it knows about a signed-in person.
 *
 * The default is a cookie and nothing else: the record is sealed into it, and the deployment needs
 * no database to hold a session. That is the right default and it is not sufficient for everyone —
 * a product that enforces **one live session per user** and wants a sign-out
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
   * The IdP's session id, the ID token's `sid`, kept across refreshes.
   *
   * It is what a back-channel logout names when one browser session ends at Keycloak rather than
   * every session the person holds, and {@link ticketStore} writes it into the ticket for that
   * reason. Absent on a realm that does not emit it, and then a logout can only end them all.
   */
  readonly sid?: string;
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
   * lifetime comes from the envelope it arrived in, and {@link Session.expiresAt} is this same
   * number: the moment the next renewal is due.
   */
  readonly accessTokenExpiresAt?: number;
  /** Rotated on every use, per RFC 10017. The stored one is always the newest issued. */
  readonly refreshToken?: string;
  /** Kept for `id_token_hint` at the end-session endpoint; without it the IdP asks who is leaving. */
  readonly idToken?: string;
}

/**
 * Who a back-channel logout names: a person, and optionally one of their IdP sessions.
 *
 * The shape of OpenID Connect Back-Channel Logout 1.0's own claims, `sub` and `sid`.
 */
export interface SessionSubject {
  readonly sub: string;
  readonly sid?: string;
}

/**
 * Where sessions live between requests. A stable ticket, updated in place — Duende BFF's server-side
 * session — rather than a new ticket per renewal.
 *
 * The ticket is issued **once, at sign-in**, which is the session-fixation defence: whatever cookie
 * a browser arrived at the callback with, it leaves with a ticket nobody has seen before. After
 * that the ticket names the session for its whole life, and a renewal changes what the row holds
 * rather than which row it is. That is what lets a renewal that happens in the proxy leave the
 * cookie alone, and what lets two tabs renewing at once agree on the session they share.
 */
export interface SessionStore {
  /**
   * Store a record from a sign-in and return the ticket that identifies it.
   *
   * The ticket is what the cookie carries — sealed, so it never travels in the clear. **A store
   * that enforces one live session per person does it here**, by dropping that person's previous
   * ticket as it issues this one.
   */
  put(record: SessionRecord): Promise<string>;
  /**
   * Replace the record behind `ticket` after a renewal, and return the ticket to carry from now on
   * — or `null` when there is no longer a session to replace.
   *
   * A store with server state answers `ticket` itself and the cookie does not change. A store whose
   * ticket *is* the record — {@link statelessStore} — has no row to update and answers a new
   * ticket, which is the cookie being re-sealed.
   *
   * **The write is conditional.** A back-channel logout may delete the row while a renewal is in
   * flight; an unconditional write would bring the ended session back. `null` is the renewal
   * learning it lost that race, and the session ends instead.
   */
  update(ticket: string, record: SessionRecord): Promise<string | null>;
  /** The record, or `null` when the ticket is unknown, expired, or has been revoked. */
  get(ticket: string): Promise<SessionRecord | null>;
  /** Forget it. Sign-out, and the immediate invalidation a self-contained cookie cannot do. */
  drop(ticket: string): Promise<void>;
  /**
   * Forget every session of `sub`, or only the one Keycloak calls `sid` — a back-channel logout.
   *
   * A store that cannot find a person's sessions rejects with `AuthError` `session/irrevocable`
   * rather than answering as though it had: a logout that ends nothing must not report success to
   * the identity provider.
   */
  dropAll(subject: SessionSubject): Promise<void>;
}

/**
 * The default: no server state at all. The ticket *is* the record.
 *
 * What it cannot do, stated plainly rather than discovered later: **`drop` does nothing**, and
 * **`dropAll` refuses** with `session/irrevocable`. Signing out clears the cookie, which is enough
 * for the person holding the browser and is not enough for anyone else — a copy of that cookie
 * taken beforehand keeps working until it expires. A session lifetime is therefore a real security
 * parameter under this store, and neither "sign out everywhere" nor a back-channel logout is
 * implementable on top of it — Auth0's SDK requires a session store for back-channel logout for
 * the same reason. Give `relyingParty` a {@link ticketStore} when either matters.
 *
 * `update` re-seals: the record changed, so the ticket that *is* the record changes with it, and
 * the cookie carrying it is reissued.
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
    async update(_ticket, record) {
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
    async dropAll() {
      throw new AuthError(
        "session/irrevocable",
        "a stateless session lives in the cookie, so no server can end it: give relyingParty a ticketStore",
      );
    },
  };
}

/**
 * What a store needs from a deployment's own database — read, write, a conditional replace and a
 * delete — and a fifth that only a back-channel logout needs.
 *
 * Keys and opaque strings, because that is the intersection of Redis, a SQL table, a KV namespace
 * and a file on disk — anything narrower would name one of them. **An adapter does not bound its
 * own waits**: {@link ticketStore} races every call against the package's deadline, so a driver
 * call is all an adapter is. What it still owns is the driver's own configuration — a connect
 * timeout, no offline queue — which is what makes a store that is down refuse at once rather than
 * hang until the deadline.
 *
 * The value is already serialized and it is **not encrypted**: it lives inside the deployment's own trust boundary, and a key held
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
  /**
   * Overwrite `key` only if it still exists, and say whether it did — Redis `SET … XX`, SQL
   * `UPDATE … WHERE key = ?` and its row count.
   *
   * One atomic step, because the check and the write must not have a gap between them: that gap
   * is where a back-channel logout's delete lands and a renewal's write undoes it.
   */
  replace(key: string, value: string, ttl: number): Promise<boolean>;
  delete(key: string): Promise<void>;
  /**
   * Every key that begins with `prefix` — Redis `SCAN MATCH <prefix>*`, SQL `LIKE '<prefix>%'`.
   *
   * Optional, because only `dropAll` uses it; without it a back-channel logout answers that it
   * cannot end anything. The prefix never contains a glob metacharacter — see
   * {@link ticketStore} — so the Redis pattern is literal as written. A SQL adapter still escapes
   * `%` and `_`, which percent-encoding produces.
   */
  keys?(prefix: string): AsyncIterable<string>;
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
 * `encodeURIComponent`, and the five characters it leaves alone that a glob or a pattern reads:
 * `!`, `'`, `(`, `)` and `*`. A subject spelled `*` must not become a prefix that matches everyone.
 */
function keySegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** Where a person's tickets begin, or one IdP session's: `<sub>:` and `<sub>:<sid>:`. */
function prefixOf(subject: SessionSubject): string {
  const sub = `${keySegment(subject.sub)}:`;
  return subject.sid === undefined ? sub : `${sub}${keySegment(subject.sid)}:`;
}

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
 * kanzoAuth(() => ({
 *   …,
 *   store: ticketStore({
 *     read: (key) => redis.get(key),
 *     write: (key, value, ttl) => redis.set(key, value, { EX: ttl }),
 *     replace: async (key, value, ttl) => (await redis.set(key, value, { XX: true, EX: ttl })) === "OK",
 *     delete: (key) => redis.del(key),
 *     // node-redis 5 yields a batch of keys per SCAN step
 *     async *keys(prefix) {
 *       for await (const batch of redis.scanIterator({ MATCH: `${prefix}*` })) yield* batch;
 *     },
 *   }),
 * }));
 * ```
 *
 * ## What this buys that the cookie cannot
 *
 * **`drop` deletes.** Under {@link statelessStore} the ticket is the record, so a copy of the
 * cookie taken before sign-out keeps working until it expires and *sign out everywhere* is not
 * expressible at all. Here the cookie is a name for a row, and deleting the row ends every copy of
 * the cookie at once, immediately.
 *
 * ## Every wait on the adapter is bounded here
 *
 * Each `read`, `write` and `delete` is raced against `DEADLINE` (30 s), and one that has not
 * answered by then rejects as `AuthError` `session/silent` with `{ after }` — which the server
 * reports as `session/unavailable`, with that as its cause, like any other failure of the store.
 * The library makes the wait, so the library bounds it: a deployment that forgot to race its
 * Redis client would otherwise hang a page on a store that stopped answering.
 *
 * ## The key carries the subject and the IdP session, and that is deliberate
 *
 * A ticket is `<sub>:<sid>:<random>`, each part percent-encoded. The random part is the whole of
 * the security — the subject and session id are not secrets and are not trusted on the way back
 * in, because the record they name is read from the row and never from the key. What the prefix
 * buys is the one operation a flat random key makes impossible: *every session belonging to this
 * person*, or *the one Keycloak just ended*. That is `dropAll`, which a back-channel logout calls,
 * and it is a prefix scan through the adapter's `keys` — the same `SCAN sub:*` a deployment could
 * write by hand for "sign out on every device".
 *
 * ## `update` keeps the ticket
 *
 * A renewal rewrites the row under the same key, so the cookie that names it is untouched. It goes
 * through `replace`, never `write`, so a row a back-channel logout deleted stays deleted. It also
 * restarts the row's `ttl`, which can then outlive the cookie by up to one `ttl`; that is a row the
 * adapter forgets later, never a session, because nothing can present the expired cookie.
 */
export function ticketStore(adapter: TicketAdapter, config: TicketStoreConfig = {}): SessionStore {
  const ttl = config.ttl ?? DEFAULT_TTL;
  const bounded = <T>(call: () => Promise<T>) => deadline("session/silent", call);

  return {
    async put(record) {
      // Encoded per part, not as a whole key: a `sub` is a uuid on every realm anyone has seen, and
      // on the one that makes it something with a colon in it the prefix must still be the prefix.
      // The random part needs no encoding — base64url is already key-safe.
      const ticket = `${prefixOf({ sub: record.session.user.id, sid: record.sid ?? "" })}${opaqueTicket()}`;
      await bounded(() => adapter.write(ticket, JSON.stringify(record), ttl));
      return ticket;
    },

    async update(ticket, record) {
      const replaced = await bounded(() => adapter.replace(ticket, JSON.stringify(record), ttl));
      return replaced ? ticket : null;
    },

    async get(ticket) {
      const value = await bounded(() => adapter.read(ticket));
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
      await bounded(() => adapter.delete(ticket));
    },

    async dropAll(subject) {
      const keys = adapter.keys?.bind(adapter);
      if (keys === undefined) {
        throw new AuthError(
          "session/irrevocable",
          "the ticket adapter has no `keys`, so a person's sessions cannot be found to end them",
        );
      }
      await bounded(async () => {
        for await (const key of keys(prefixOf(subject))) await adapter.delete(key);
      });
    },
  };
}
