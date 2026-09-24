// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sealedCookie } from "./cookie-session";
import { statelessStore, ticketStore, type SessionRecord, type SessionStore } from "./store";
import type { Session } from "./types";

const SESSION: Session = {
  user: { id: "u-1", email: "ada@example.test", name: "Ada" },
  roles: ["owner"],
  organizations: [{ alias: "acme", id: "org-1", roles: ["owner"] }],
  expiresAt: 1_800_000_000_000,
};

const RECORD: SessionRecord = { session: SESSION, refreshToken: "r-1", idToken: "id-1" };

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
});

describe("SessionStore", () => {
  it("is satisfied by a store that enforces one live session per person", async () => {
    // The interface exists for keasy, whose `server/src/db/sessions.rs` allows one session per
    // user and revokes on sign-out. Thirty lines here is the whole of what that costs, and writing
    // it is the check that the three methods are the right three.
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
      async get(ticket) {
        return records.get(ticket) ?? null;
      },
      async drop(ticket) {
        records.delete(ticket);
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
  /** The two functions and a delete, over a `Map`. This is the whole of what a deployment writes. */
  function inMemory() {
    const rows = new Map<string, string>();
    const ttls = new Map<string, number>();
    return {
      rows,
      ttls,
      adapter: {
        async read(key: string) {
          return rows.get(key) ?? null;
        },
        async write(key: string, value: string, ttl: number) {
          rows.set(key, value);
          ttls.set(key, ttl);
        },
        async delete(key: string) {
          rows.delete(key);
        },
      },
    };
  }

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
    // 32 bytes of base64url after the subject, which is 43 characters and no padding.
    expect(ticket).toMatch(/^u-1:[A-Za-z0-9_-]{43}$/);
  });

  it("never issues the same ticket twice", async () => {
    const store = ticketStore(inMemory().adapter);

    const issued = await Promise.all(Array.from({ length: 50 }, () => store.put(RECORD)));

    expect(new Set(issued).size).toBe(50);
  });

  /**
   * "Sign out on every device" is a query a deployment can write, and this prefix is what makes it
   * one. Asserted because a later tidy-up that made the ticket a flat random string would look
   * like a simplification and would quietly remove the only handle onto *this person's sessions*.
   */
  it("keys a person's sessions under a prefix a deployment can scan", async () => {
    const backing = inMemory();
    const store = ticketStore(backing.adapter);

    await store.put(RECORD);
    await store.put(RECORD);
    await store.put({ ...RECORD, session: { ...SESSION, user: { id: "u-2" } } });

    const ada = [...backing.rows.keys()].filter((key) => key.startsWith("u-1:"));
    expect(ada).toHaveLength(2);

    for (const key of ada) await backing.adapter.delete(key);
    expect(backing.rows.size).toBe(1);
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

    expect(await store.get("u-1:nobody")).toBeNull();

    backing.rows.set("u-1:corrupt", "not json");
    expect(await store.get("u-1:corrupt")).toBeNull();
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
      async delete() {},
    }).put(KEYCLOAK);

    const header = await cookie.seal({ ticket });
    // Under 400 bytes, and the same 400 bytes whatever the realm puts in a token.
    expect(header.length).toBeLessThan(400);
  });
});
