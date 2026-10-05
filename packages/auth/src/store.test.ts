// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { sealedCookie } from "./cookie-session";
import { statelessStore, ticketStore, type SessionRecord, type SessionStore } from "./store";
import { inMemoryAdapter } from "./test/fake-keycloak";
import { AuthError, type Session } from "./types";

const SESSION: Session = {
  user: { id: "u-1", email: "ada@example.test", name: "Ada" },
  roles: ["owner"],
  organizations: [{ alias: "acme", id: "org-1", roles: ["owner"] }],
  expiresAt: 1_800_000_000_000,
};

const RECORD: SessionRecord = { session: SESSION, sid: "s-1", refreshToken: "r-1", idToken: "id-1" };

describe("statelessStore", () => {
  it("returns the record it was given", async () => {
    const store = statelessStore();
    const ticket = await store.put(RECORD);

    expect(await store.get(ticket)).toEqual(RECORD);
  });

  it("answers null for a ticket it cannot read", async () => {
    const store = statelessStore();

    expect(await store.get("not a ticket")).toBeNull();
  });

  it("cannot invalidate, and says so by leaving the record readable after a drop", async () => {
    const store = statelessStore();
    const ticket = await store.put(RECORD);

    await store.drop(ticket);

    // This is the documented limit of the default, asserted rather than left for someone to
    // discover: the ticket *is* the record, so nothing here can take back a copy already made.
    // Clearing the cookie ends it for the browser holding it and for nobody else.
    expect(await store.get(ticket)).toEqual(RECORD);
  });

  it("re-seals on update, because the ticket is the record", async () => {
    const store = statelessStore();
    const ticket = await store.put(RECORD);
    const renewed = { ...RECORD, refreshToken: "r-2" };

    const next = await store.update(ticket, renewed);

    expect(next).not.toBe(ticket);
    expect(await store.get(next ?? "")).toEqual(renewed);
  });

  it("refuses a back-channel logout rather than pretending to have ended anything", async () => {
    await expect(statelessStore().dropAll({ sub: "u-1" })).rejects.toMatchObject({
      code: "session/irrevocable",
    });
  });
});

describe("SessionStore", () => {
  it("is satisfied by a store that enforces one live session per person", async () => {
    // The interface exists for a product that allows one session per user and revokes on
    // sign-out. Forty lines here is the whole of what that costs, and writing it is the check
    // that the five methods are the right five.
    const records = new Map<string, SessionRecord>();
    const live = new Map<string, string>();
    let next = 0;

    const oneEach: SessionStore = {
      async put(record) {
        const previous = live.get(record.session.user.id);
        if (previous !== undefined) records.delete(previous);
        const ticket = `t-${++next}`;
        records.set(ticket, record);
        live.set(record.session.user.id, ticket);
        return ticket;
      },
      async update(ticket, record) {
        if (!records.has(ticket)) return null;
        records.set(ticket, record);
        return ticket;
      },
      async get(ticket) {
        return records.get(ticket) ?? null;
      },
      async drop(ticket) {
        records.delete(ticket);
      },
      async dropAll({ sub }) {
        const ticket = live.get(sub);
        if (ticket !== undefined) records.delete(ticket);
      },
    };

    const first = await oneEach.put(RECORD);
    const second = await oneEach.put(RECORD);

    expect(await oneEach.get(first)).toBeNull();
    expect(await oneEach.get(second)).toEqual(RECORD);

    await oneEach.drop(second);
    expect(await oneEach.get(second)).toBeNull();
  });
});

describe("ticketStore", () => {
  const inMemory = inMemoryAdapter;

  /**
   * The store makes the wait, so the store bounds it: an adapter is a driver call and nothing else,
   * and a deployment that forgot to race its client must not hang a page on a store that stopped
   * answering.
   */
  it("gives up on an adapter call that never answers, after 30 s and not before, as session/silent", async () => {
    vi.useFakeTimers();
    try {
      const hung = new Promise<never>(() => {});
      const store = ticketStore({
        read: () => hung,
        write: () => hung,
        replace: () => hung,
        delete: () => hung,
        keys: () => ({ [Symbol.asyncIterator]: () => ({ next: () => hung }) }),
      });
      const calls = [
        () => store.get("u-1:s-1:x"),
        () => store.put(RECORD),
        () => store.update("u-1:s-1:x", RECORD),
        () => store.drop("u-1:s-1:x"),
        () => store.dropAll({ sub: "u-1" }),
      ];
      for (const call of calls) {
        const settled = vi.fn();
        const outcome = call().then(settled, (error: unknown) => {
          settled(error);
          return error;
        });
        await vi.advanceTimersByTimeAsync(29_999);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        const failed = await outcome;
        expect(failed).toBeInstanceOf(AuthError);
        expect(failed).toMatchObject({ code: "session/silent", data: { after: 30_000 } });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands an adapter's own failure through unchanged", async () => {
    const down = new Error("ECONNREFUSED");
    const store = ticketStore({
      read: () => Promise.reject(down),
      write: () => Promise.reject(down),
      replace: () => Promise.reject(down),
      delete: () => Promise.reject(down),
    });
    await expect(store.get("u-1:s-1:x")).rejects.toBe(down);
  });

  it("round-trips a record through the adapter", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);

    const ticket = await store.put(RECORD);

    expect(await store.get(ticket)).toEqual(RECORD);
    expect(backing.rows.size).toBe(1);
  });

  /**
   * The whole reason this exists. Under `statelessStore` the assertion beside it is the opposite
   * one, and that is not a difference in quality — it is the difference between a sign-out and a
   * sign-out for the person who happens to be holding the browser.
   */
  it("invalidates, which is the thing the cookie cannot do", async () => {
    const store = ticketStore(inMemory().adapter);
    const ticket = await store.put(RECORD);

    await store.drop(ticket);

    expect(await store.get(ticket)).toBeNull();
  });

  it("puts nothing a cookie could be opened for into the ticket", async () => {
    const store = ticketStore(inMemory().adapter);

    const ticket = await store.put(RECORD);

    expect(ticket).not.toContain("r-1");
    expect(ticket).not.toContain("id-1");
    // The subject, the IdP session, and 32 bytes of base64url: 43 characters and no padding.
    expect(ticket).toMatch(/^u-1:s-1:[A-Za-z0-9_-]{43}$/);
  });

  it("never issues the same ticket twice", async () => {
    const store = ticketStore(inMemory().adapter);

    const issued = await Promise.all(Array.from({ length: 50 }, () => store.put(RECORD)));

    expect(new Set(issued).size).toBe(50);
  });

  /**
   * Duende's server-side session: a renewal rewrites the row under the ticket it already has, so
   * the cookie naming it does not change and nothing has to be handed back to the browser.
   */
  it("updates in place, under the ticket it already issued", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);
    const ticket = await store.put(RECORD);
    const renewed = { ...RECORD, refreshToken: "r-2" };

    expect(await store.update(ticket, renewed)).toBe(ticket);
    expect(await store.get(ticket)).toEqual(renewed);
    expect(backing.rows.size).toBe(1);
  });

  /**
   * The race a back-channel logout and a renewal can run: the logout deletes the row while the
   * grant is in flight, and the renewal's write must not bring it back.
   */
  it("does not resurrect a row deleted while the update was on its way", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);
    const ticket = await store.put(RECORD);

    await store.dropAll({ sub: "u-1" });

    expect(await store.update(ticket, { ...RECORD, refreshToken: "r-2" })).toBeNull();
    expect(backing.rows.size).toBe(0);
  });

  it("ends every session of a person, and only theirs, by subject", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);
    const ada = [await store.put(RECORD), await store.put({ ...RECORD, sid: "s-2" })];
    const grace = await store.put({ ...RECORD, session: { ...SESSION, user: { id: "u-10" } } });

    await store.dropAll({ sub: "u-1" });

    for (const ticket of ada) expect(await store.get(ticket)).toBeNull();
    // `u-1:` is not a prefix of `u-10:`: the separator is part of the prefix.
    expect(await store.get(grace)).not.toBeNull();
  });

  it("ends one IdP session when the logout names it", async () => {
    const store = ticketStore(inMemory().adapter);
    const here = await store.put(RECORD);
    const elsewhere = await store.put({ ...RECORD, sid: "s-2" });

    await store.dropAll({ sub: "u-1", sid: "s-1" });

    expect(await store.get(here)).toBeNull();
    expect(await store.get(elsewhere)).not.toBeNull();
  });

  /**
   * The prefix is handed to a Redis `SCAN MATCH`, where `*` is a wildcard. A subject spelled `*`
   * would otherwise be a back-channel logout of everyone.
   */
  it("hands keys a prefix with no glob in it, whatever the subject is spelled", async () => {
    const asked: string[] = [];
    const backing = inMemory();
    const store = ticketStore({
      ...backing.adapter,
      keys(prefix: string) {
        asked.push(prefix);
        return backing.adapter.keys(prefix);
      },
    });

    await store.dropAll({ sub: "*", sid: "a(b)!'" });

    expect(asked).toEqual(["%2A:a%28b%29%21%27:"]);
  });

  it("refuses a back-channel logout when the adapter cannot list keys", async () => {
    const withoutKeys = { ...inMemory().adapter, keys: undefined };

    await expect(ticketStore(withoutKeys).dropAll({ sub: "u-1" })).rejects.toMatchObject({
      code: "session/irrevocable",
    });
  });

  it("hands the adapter the lifetime to forget the row after", async () => {
    const backing = inMemory();

    await ticketStore(backing.adapter).put(RECORD);
    expect([...backing.ttls.values()]).toEqual([8 * 60 * 60]);

    const shorter = inMemory();
    await ticketStore(shorter.adapter, { ttl: 900 }).put(RECORD);
    expect([...shorter.ttls.values()]).toEqual([900]);
  });

  it("answers null for a ticket the adapter does not know, and for a row it cannot read", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);

    expect(await store.get("u-1:s-1:nobody")).toBeNull();

    backing.rows.set("u-1:s-1:corrupt", "not json");
    expect(await store.get("u-1:s-1:corrupt")).toBeNull();
  });
});

/**
 * What fits in a cookie, measured rather than estimated.
 *
 * The lengths are a real Keycloak 26 token set for a person in two organizations with the roles
 * that come with them: an access token of 1733 characters, an ID token of 1456 and a refresh token
 * of 834. JWE with `A256GCM` is a stream cipher, so the ciphertext is the length of the plaintext
 * whatever the plaintext says — which is what lets a test assert a byte count without minting real
 * JWTs to do it.
 */
describe("the 4096 bytes a browser is required to keep", () => {
  /** What `relyingParty` seals: `{ ticket }`, whatever the store made the ticket out of. */
  const cookie = sealedCookie<{ ticket: string }>({
    name: "kanzo-session",
    secret: "a-secret-nobody-chose-by-hand",
    maxAge: 8 * 60 * 60,
  });

  const KEYCLOAK: SessionRecord = {
    session: SESSION,
    accessToken: "a".repeat(1733),
    accessTokenExpiresAt: 1_800_000_000_000,
    refreshToken: "r".repeat(834),
    idToken: "i".repeat(1456),
  };

  it("is not enough for a stateless record once it holds an access token", async () => {
    const stateless = statelessStore();
    /** The same record as it was before this release: the two identity tokens and no credential. */
    const before: SessionRecord = {
      session: KEYCLOAK.session,
      refreshToken: KEYCLOAK.refreshToken,
      idToken: KEYCLOAK.idToken,
    };

    // 4068 of 4096 without the access token, which is 28 bytes of margin and was never a design —
    // one more organization went over it. With the access token there is no version of this that
    // fits, and that is the breaking change: a product calling a resource server needs a
    // `ticketStore`, and the seal says so rather than letting a browser drop the cookie in silence.
    const fitted = await cookie.seal({ ticket: await stateless.put(before) });
    expect(fitted.length).toBeLessThan(4096);

    await expect(cookie.seal({ ticket: await stateless.put(KEYCLOAK) })).rejects.toThrow(
      /ticketStore/,
    );
  });

  it("is plenty for a ticket, which is the point of one", async () => {
    const ticket = await ticketStore({
      async read() {
        return null;
      },
      async write() {},
      async replace() {
        return false;
      },
      async delete() {},
    }).put(KEYCLOAK);

    const header = await cookie.seal({ ticket });
    // Under 400 bytes, and the same 400 bytes whatever the realm puts in a token.
    expect(header.length).toBeLessThan(400);
  });
});
