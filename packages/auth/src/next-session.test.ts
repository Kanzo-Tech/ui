// @vitest-environment node
import { cookies } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sealedCookie } from "./cookie-session";
import { authSession, type AuthSessionConfig } from "./next-session";
import { relyingParty } from "./server";
import type { SessionRecord, SessionStore } from "./store";
import type { Session } from "./types";

// An RSC has no `Request`; `next/headers` is how it reaches the one it is rendering for, and this
// is the only thing in these three modules that a unit test cannot simply construct.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SECRET = "a-secret-nobody-chose-by-hand";

const SESSION: Session = {
  user: { id: "u-1", username: "ada" },
  roles: ["admin"],
  organizations: [{ alias: "acme", roles: ["owner"] }],
  expiresAt: 4_000_000_000_000,
};

/** A store that answers for exactly one ticket, so no realm is needed to have a session. */
function oneRecord(record: SessionRecord): SessionStore {
  return {
    put: async () => "the-ticket",
    get: async (ticket) => (ticket === "the-ticket" ? record : null),
    drop: async () => {},
  };
}

/** What the browser would send: the cookie `relyingParty` seals, minted here from the same parts. */
async function sessionCookie(): Promise<string> {
  const cookie = sealedCookie<{ ticket: string }>({
    name: "kanzo-session",
    secret: SECRET,
    maxAge: 3600,
  });
  const header = await cookie.seal({ ticket: "the-ticket" });
  return header.slice(0, header.indexOf(";"));
}

function arriving(cookie: string): void {
  vi.mocked(cookies).mockImplementation(
    async () => ({ toString: () => cookie }) as unknown as Awaited<ReturnType<typeof cookies>>,
  );
}

describe("authSession", () => {
  let config: AuthSessionConfig;

  beforeEach(() => {
    vi.mocked(cookies).mockReset();
    config = {
      issuer: "https://id.example.test/realms/kanzo",
      clientId: "keasy",
      clientSecret: "client-secret",
      secret: SECRET,
      store: oneRecord({ session: SESSION }),
    };
  });

  /**
   * The tie between the cookie this file mints and the one `relyingParty` issues. Nothing here
   * reaches Keycloak — reading a session unseals a cookie and asks the store — so the risk is that
   * the name, the secret or the payload shape drift apart and every assertion below keeps passing
   * against a session nobody could ever have had. This is the assertion that would stop.
   */
  it("reads the cookie relyingParty itself would read", async () => {
    const cookie = await sessionCookie();

    expect(await relyingParty({ ...config, redirectUri: "" }).read(cookie)).toEqual(SESSION);
  });

  it("answers with the session the request carries", async () => {
    arriving(await sessionCookie());

    expect(await authSession(config)()).toEqual(SESSION);
  });

  it("answers null when the request carries no cookie", async () => {
    arriving("");

    expect(await authSession(config)()).toBeNull();
  });

  it("answers null for a cookie it cannot open", async () => {
    arriving("__Host-kanzo-session=forged");

    expect(await authSession(config)()).toBeNull();
  });

  it("answers null when the cookie names a ticket the store has forgotten", async () => {
    arriving(await sessionCookie());

    expect(
      await authSession({ ...config, store: { ...oneRecord({ session: SESSION }), get: async () => null } })(),
    ).toBeNull();
  });

  /**
   * A page asks in a layout, in a breadcrumb and in a menu, and gets one answer three times.
   *
   * **What this does not prove is the `cache`.** React's `cache` needs a request scope to memoize
   * in, and outside one it simply calls through — so the number of reads here is not the number a
   * server component would cause, and asserting on it would be asserting on vitest. The agreement
   * of the three answers is what is checked; the saving is the reason for `cache` and is only
   * observable inside Next.
   */
  it("gives the same answer however many times a page asks", async () => {
    arriving(await sessionCookie());
    const getSession = authSession(config);

    expect(await Promise.all([getSession(), getSession(), getSession()])).toEqual([
      SESSION,
      SESSION,
      SESSION,
    ]);
  });
});
