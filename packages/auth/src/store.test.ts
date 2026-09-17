// @vitest-environment node
import { describe, expect, it } from "vitest";
import { statelessStore, type SessionRecord, type SessionStore } from "./store";
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
