// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  relyingParty,
  type Ended,
  type RelyingPartyConfig,
  type Renewed,
  type Token,
} from "./server";
import { statelessStore, ticketStore, type SessionRecord, type SessionStore } from "./store";
import {
  CLIENT_ID,
  ISSUER,
  SECRET,
  asRequestHeader,
  fakeKeycloak,
  inMemoryAdapter,
  type Realm,
} from "./test/fake-keycloak";
import { AuthError } from "./types";

const INTERNAL = "http://keycloak:8080";
const REDIRECT_URI = "https://app.example.test/api/auth/callback";

/** A live session, or the test fails here with what came back instead. */
function alive<T extends Renewed>(outcome: T | Ended): T {
  if (outcome.ended) throw new Error(`expected a live session, got ${outcome.code}`);
  return outcome;
}

/**
 * A store over a `Map` that writes down what it was asked, because "the callback reads nothing"
 * and "the renewal keeps the ticket" are statements about calls, and only the store can see them.
 */
function recordingStore() {
  const records = new Map<string, SessionRecord>();
  const calls: string[] = [];
  let next = 0;
  const store: SessionStore = {
    async put(record) {
      const ticket = `t-${++next}`;
      calls.push(`put ${ticket}`);
      records.set(ticket, record);
      return ticket;
    },
    async update(ticket, record) {
      calls.push(`update ${ticket}`);
      if (!records.has(ticket)) return null;
      records.set(ticket, record);
      return ticket;
    },
    async get(ticket) {
      calls.push(`get ${ticket}`);
      return records.get(ticket) ?? null;
    },
    async drop(ticket) {
      calls.push(`drop ${ticket}`);
      records.delete(ticket);
    },
    async dropAll() {
      throw new Error("not under test");
    },
  };
  return { store, records, calls };
}

/** Walk one sign-in: begin, answer as Keycloak would, complete. */
async function signIn(
  auth: ReturnType<typeof relyingParty>,
  realm: Realm,
  claims: Record<string, unknown> = { sub: "u-1", preferred_username: "ada" },
  options: { readonly returnTo?: string } = {},
) {
  const started = await auth.begin({ redirectUri: REDIRECT_URI, ...options });
  const sent = new URL(started.url);
  const state = sent.searchParams.get("state") ?? "";
  realm.state.idTokenClaims = { nonce: sent.searchParams.get("nonce"), ...claims };

  const done = await auth.complete({
    url: `${REDIRECT_URI}?code=the-code&state=${state}`,
    cookie: asRequestHeader(started.cookies),
    redirectUri: REDIRECT_URI,
  });
  return { started, sent, state, done };
}

describe("relyingParty", () => {
  let realm: Realm;
  let config: RelyingPartyConfig;

  beforeEach(() => {
    realm = fakeKeycloak();
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: SECRET,
      fetch: realm.fetchImpl,
    };
  });

  describe("begin", () => {
    it("sends the browser to the authorization endpoint with PKCE, state and nonce", async () => {
      const { url, cookies } = await relyingParty(config).begin({ redirectUri: REDIRECT_URI });
      const sent = new URL(url);

      expect(sent.origin + sent.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
      expect(sent.searchParams.get("client_id")).toBe(CLIENT_ID);
      expect(sent.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
      expect(sent.searchParams.get("code_challenge_method")).toBe("S256");
      expect(sent.searchParams.get("code_challenge")).toBeTruthy();
      expect(sent.searchParams.get("state")).toBeTruthy();
      expect(sent.searchParams.get("nonce")).toBeTruthy();
      expect(sent.searchParams.get("scope")).toBe("openid profile email organization:*");

      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.startsWith(`__Host-kanzo-auth.${sent.searchParams.get("state")}=`)).toBe(true);
    });

    it("keeps the verifier off the wire", async () => {
      const { url, cookies } = await relyingParty(config).begin({ redirectUri: REDIRECT_URI });

      // The challenge goes to Keycloak; the verifier stays with us, sealed. Sending both is the
      // mistake PKCE exists to prevent, and it is one field away.
      const challenge = new URL(url).searchParams.get("code_challenge") ?? "";
      expect(url).not.toContain("code_verifier");
      expect(cookies[0]).not.toContain(challenge);
    });

    it("asks for one organization's scope in place of every one when told which", async () => {
      const { url } = await relyingParty(config).begin({ redirectUri: REDIRECT_URI, organization: "acme" });

      expect(new URL(url).searchParams.get("scope")).toBe(
        "openid profile email organization:acme",
      );
    });

    /**
     * `scope` is a space-delimited list, so an alias with a space in it is not one scope with a
     * space in it — it is two scopes, and the second is whatever was written. Every product with
     * an organization switcher passes a query parameter straight into this, and `authRoutes` did.
     */
    it("refuses an organization that would inject a second scope", async () => {
      const auth = relyingParty(config);

      await expect(auth.begin({ redirectUri: REDIRECT_URI, organization: "acme offline_access" })).rejects.toMatchObject({
        code: "organization/invalid",
      });
      await expect(auth.begin({ redirectUri: REDIRECT_URI, organization: "acme\toffline_access" })).rejects.toMatchObject({
        code: "organization/invalid",
      });
      await expect(auth.begin({ redirectUri: REDIRECT_URI, organization: "" })).rejects.toMatchObject({
        code: "organization/invalid",
      });
      await expect(auth.begin({ redirectUri: REDIRECT_URI, organization: "acme:*" })).rejects.toMatchObject({
        code: "organization/invalid",
      });
    });

    it("still takes the aliases a realm actually mints, and the star", async () => {
      const auth = relyingParty(config);

      for (const alias of ["acme", "beta-labs", "a.b_c-9", "*"]) {
        const { url } = await auth.begin({ redirectUri: REDIRECT_URI, organization: alias });
        expect(new URL(url).searchParams.get("scope")).toBe(
          `openid profile email organization:${alias}`,
        );
      }
    });

    it("reaches Keycloak on the internal origin while sending the browser to the public one", async () => {
      const { url } = await relyingParty({ ...config, internalOrigin: INTERNAL }).begin({ redirectUri: REDIRECT_URI });

      expect(url.startsWith(ISSUER)).toBe(true);
      expect(realm.state.calls).toEqual([
        "http://keycloak:8080/realms/kanzo/.well-known/openid-configuration",
      ]);
    });
  });

  describe("complete", () => {
    it("exchanges the code and reads the claims into a Session", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm, {
        sub: "u-1",
        preferred_username: "ada",
        email: "ada@example.test",
        name: "Ada Lovelace",
        realm_access: { roles: ["default-roles"] },
        resource_access: { board: { roles: ["owner"] } },
        organization: {
          acme: {
            id: "org-1",
            resource_access: { board: { roles: ["owner"] }, hub: { roles: ["reader"] } },
          },
        },
      });

      expect(done.session.user).toEqual({
        id: "u-1",
        email: "ada@example.test",
        name: "Ada Lovelace",
        username: "ada",
      });
      expect(done.session.roles).toEqual(["default-roles", "owner"]);
      // `hub`'s reader is another application's role and must not arrive here — `claims.ts` does
      // that filtering, and this is the door proving it is the reader being used.
      expect(done.session.organizations).toEqual([
        { alias: "acme", id: "org-1", roles: ["owner"] },
      ]);
    });

    it("sends the PKCE verifier to the token endpoint", async () => {
      await signIn(relyingParty(config), realm);

      expect(realm.state.posted[0]?.get("code_verifier")).toBeTruthy();
      expect(realm.state.posted[0]?.get("grant_type")).toBe("authorization_code");
    });

    it("issues a session cookie and clears that attempt's transaction cookie", async () => {
      const { done, state } = await signIn(relyingParty(config), realm);

      expect(done.cookies).toHaveLength(2);
      expect(done.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
      expect(done.cookies[1]).toContain(`__Host-kanzo-auth.${state}=;`);
      expect(done.cookies[1]).toContain("Max-Age=0");
    });

    /**
     * Two tabs signing in at once. With one transaction cookie the second `begin` overwrote the
     * first, and the first tab's callback found someone else's attempt. Auth0's v4 SDK names the
     * cookie by `state` for exactly this, and so does this one.
     */
    it("completes two sign-ins started in parallel, each with its own state", async () => {
      const auth = relyingParty(config);
      const first = await auth.begin({ redirectUri: REDIRECT_URI, returnTo: "/one" });
      const second = await auth.begin({ redirectUri: REDIRECT_URI, returnTo: "/two" });
      const jar = asRequestHeader([...first.cookies, ...second.cookies]);

      const finish = async (started: typeof first) => {
        const sent = new URL(started.url);
        realm.state.idTokenClaims = { sub: "u-1", nonce: sent.searchParams.get("nonce") };
        return auth.complete({
          url: `${REDIRECT_URI}?code=c&state=${sent.searchParams.get("state")}`,
          cookie: jar,
          redirectUri: REDIRECT_URI,
        });
      };

      expect((await finish(second)).returnTo).toBe("/two");
      expect((await finish(first)).returnTo).toBe("/one");
    });

    it("sends the token request the redirect URI the authorization request named", async () => {
      // A request that reached the callback under another host — a proxy that rewrote it — must
      // still repeat the registered URI, or Keycloak refuses the code (RFC 6749 §4.1.3).
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const sent = new URL(started.url);
      realm.state.idTokenClaims = { sub: "u-1", nonce: sent.searchParams.get("nonce") };

      await auth.complete({
        url: `http://internal:3000/api/auth/callback?code=c&state=${sent.searchParams.get("state")}`,
        cookie: asRequestHeader(started.cookies),
        redirectUri: REDIRECT_URI,
      });

      expect(realm.state.posted[0]?.get("redirect_uri")).toBe(REDIRECT_URI);
    });

    it("keeps the IdP's session id on the record, for a back-channel logout to find", async () => {
      const { store, records } = recordingStore();
      realm.state.sid = "keycloak-session-7";

      await signIn(relyingParty({ ...config, store }), realm);

      expect([...records.values()][0]?.sid).toBe("keycloak-session-7");
    });

    it("says the session expires when its access token does", async () => {
      realm.state.expiresIn = 120;
      const before = Date.now();

      const { done } = await signIn(relyingParty(config), realm);
      const after = Date.now();

      // `expiresIn()` counts whole seconds down from the parse, so a second may already be gone.
      expect(done.session.expiresAt).toBeGreaterThanOrEqual(before + 119_000);
      expect(done.session.expiresAt).toBeLessThanOrEqual(after + 120_000);
    });

    it("returns where the person was going", async () => {
      const { done } = await signIn(relyingParty(config), realm, undefined, { returnTo: "/jobs/7" });

      expect(done.returnTo).toBe("/jobs/7");
    });

    it("refuses a callback whose state is not the one it sent", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });

      const refused = auth.complete({
        url: `${REDIRECT_URI}?code=the-code&state=someone-elses-state`,
        cookie: asRequestHeader(started.cookies),
        redirectUri: REDIRECT_URI,
      });

      await expect(refused).rejects.toThrow(AuthError);
      await expect(refused).rejects.toMatchObject({ code: "callback/state-mismatch" });
      // And nothing was spent: the code never reached the token endpoint.
      expect(realm.state.posted).toHaveLength(0);
    });

    it("refuses a callback with no state at all", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code`,
          cookie: asRequestHeader(started.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "callback/state-mismatch" });
    });

    it("refuses a callback with no transaction cookie", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");

      // A bookmarked callback, a cookie that expired while the person read the consent screen, or
      // a code delivered to a browser that never started the flow. All the same answer.
      await expect(
        auth.complete({ url: `${REDIRECT_URI}?code=the-code&state=${state}`, cookie: null, redirectUri: REDIRECT_URI }),
      ).rejects.toMatchObject({ code: "callback/state-mismatch" });
    });

    it("refuses a transaction cookie sealed by somebody else", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");

      const forged = await relyingParty({ ...config, secret: "not-our-secret" }).begin({ redirectUri: REDIRECT_URI });

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(forged.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "callback/state-mismatch" });
    });

    it("refuses an ID token whose nonce is not the one it sent", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");
      // A replayed authorization response: the state is this transaction's, the ID token is from
      // another one. Only the nonce tells them apart.
      realm.state.idTokenClaims = { sub: "u-1", nonce: "a-nonce-from-another-sign-in" };

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "callback/nonce-mismatch" });
    });

    it("refuses an ID token with no nonce at all", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = { sub: "u-1" };

      // This is the test that pins a message match — see `isNonceMismatch`. If `oauth4webapi`
      // rewords that line, the failure belongs here, not in a production log where a replay has
      // quietly become "the token endpoint misbehaved".
      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "callback/nonce-mismatch" });
    });

    it("reports a refused token endpoint as an exchange failure", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");
      realm.state.tokenEndpointStatus = 400;

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "token/exchange-failed" });
    });

    it("fetches no keys when the token endpoint is reached over TLS, because the channel vouches", async () => {
      await signIn(relyingParty(config), realm);

      // Not an oversight: an ID token from the token endpoint over an authenticated TLS request is
      // validated by that channel (OIDC Core §3.1.3.7 step 6), and `openid-client` consults no
      // JWKS for it. Asserting the absence is how the next reader learns it was a decision.
      expect(realm.state.calls.some((c) => c.endsWith("/certs"))).toBe(false);
    });

    it("fetches the keys when the hop is plaintext, because then nothing vouches", async () => {
      // The other half of the derived default — see `verifySignatures`. `internalOrigin: http://…`
      // is how every in-cluster deployment reaches Keycloak, and it withdraws the channel's claim.
      await signIn(
        relyingParty({ ...config, internalOrigin: "http://keycloak:8080", allowInsecureHttp: true }),
        realm,
      );

      expect(realm.state.calls.some((c) => c.endsWith("/certs"))).toBe(true);
    });

    it("rediscovers once and retries when Keycloak has rotated its signing key", async () => {
      const auth = relyingParty({ ...config, verifySignatures: true });
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");

      // The realm signs with a key whose id our first JWKS fetch does not contain, and publishes
      // it on the next fetch — which is what a rotation looks like from here.
      realm.state.idTokenClaims = { sub: "u-1", nonce: new URL(started.url).searchParams.get("nonce") };
      realm.state.signingKid = "key-b";
      realm.state.publishedKids = ["key-a", "key-b"];

      const discoveries = () =>
        realm.state.calls.filter((c) => c.endsWith("openid-configuration")).length;
      expect(discoveries()).toBe(1);

      const done = await auth.complete({
        url: `${REDIRECT_URI}?code=the-code&state=${state}`,
        cookie: asRequestHeader(started.cookies),
        redirectUri: REDIRECT_URI,
      });

      expect(done.session.user.id).toBe("u-1");
      expect(discoveries()).toBe(2);
    });

    it("gives up after one retry rather than hammering the identity provider", async () => {
      const auth = relyingParty({ ...config, verifySignatures: true });
      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = { sub: "u-1", nonce: new URL(started.url).searchParams.get("nonce") };
      // The rotation never lands: the realm goes on signing with a key it never publishes.
      realm.state.signingKid = "key-b";
      realm.state.publishedKids = ["key-a"];

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
          redirectUri: REDIRECT_URI,
        }),
      ).rejects.toMatchObject({ code: "token/exchange-failed" });

      expect(realm.state.calls.filter((c) => c.endsWith("openid-configuration"))).toHaveLength(2);
    });
  });

  describe("read", () => {
    it("reads the session back out of the cookie", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      expect(await auth.read(asRequestHeader(done.cookies))).toEqual(done.session);
    });

    it("answers null with no cookie, and for one it did not seal", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);
      const theirs = relyingParty({ ...config, secret: "not-our-secret" });

      expect(await auth.read(null)).toBeNull();
      expect(await auth.read("theme=dark")).toBeNull();
      expect(await theirs.read(asRequestHeader(done.cookies))).toBeNull();
    });

    it("answers null once the store has forgotten the ticket", async () => {
      const { store, records } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      const header = asRequestHeader(done.cookies);
      expect(await auth.read(header)).not.toBeNull();

      // The invalidation the stateless default cannot do: the cookie is still valid and still
      // decrypts, and the session is gone anyway.
      records.clear();
      expect(await auth.read(header)).toBeNull();
    });
  });

  describe("refresh", () => {
    it("spends the refresh token, takes the rotated one, and re-seals a stateless cookie", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      realm.state.refreshToken = "refresh-2";
      const renewed = alive(await auth.refresh(asRequestHeader(done.cookies)));

      expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");
      expect(realm.state.posted[1]?.get("refresh_token")).toBe("refresh-1");
      expect(renewed.session.user.id).toBe("u-1");
      // Under the stateless store the ticket is the record, so a new record is a new cookie.
      expect(renewed.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);

      // The new cookie must carry the rotated token; keeping the spent one is how a session dies
      // on its next renewal.
      realm.state.refreshToken = "refresh-3";
      await auth.refresh(asRequestHeader(renewed.cookies));
      expect(realm.state.posted[2]?.get("refresh_token")).toBe("refresh-2");
    });

    /**
     * Duende BFF's stable ticket. The ticket was rotated on every renewal before, which made the
     * cookie a moving target: a tab that renewed in the proxy and a tab whose request was already
     * in flight held two different cookies for one session, and the slower one lost.
     */
    it("keeps the ticket and the cookie on a renewal under a ticket store", async () => {
      const { store, calls } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      const cookie = asRequestHeader(done.cookies);

      realm.state.refreshToken = "refresh-2";
      const renewed = alive(await auth.refresh(cookie));

      expect(renewed.cookies).toEqual([]);
      expect(calls).toEqual(["put t-1", "get t-1", "update t-1"]);
      // The same cookie now carries the rotated token, because the row behind it does.
      realm.state.refreshToken = "refresh-3";
      await auth.refresh(cookie);
      expect(realm.state.posted[2]?.get("refresh_token")).toBe("refresh-2");
    });

    /** The back-channel logout landed between reading the row and writing the renewal back. */
    it("ends the session, rather than bring it back, when the row went during the grant", async () => {
      const { store, records } = recordingStore();
      const read = store.get.bind(store);
      const auth = relyingParty({
        ...config,
        store: {
          ...store,
          async get(ticket) {
            const record = await read(ticket);
            records.delete(ticket);
            return record;
          },
        },
      });
      const { done } = await signIn(auth, realm);

      realm.state.refreshToken = "refresh-2";
      const outcome = await auth.refresh(asRequestHeader(done.cookies));

      expect(outcome).toMatchObject({ ended: true, code: "session/absent" });
      expect(outcome.cookies.join()).toMatch(/Max-Age=0/);
      expect(records.size).toBe(0);
    });

    it("keeps the IdP's session id across a renewal whose ID token omits it", async () => {
      const { store, records } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);

      realm.state.sid = "";
      realm.state.idTokenClaims = { sub: "u-1", sid: undefined };
      await auth.refresh(asRequestHeader(done.cookies));

      expect(records.get("t-1")?.sid).toBe("sid-1");
    });

    it("answers that there is nothing to renew, and sets nothing, without a cookie", async () => {
      const outcome = await relyingParty(config).refresh(null);

      expect(outcome).toEqual({ ended: true, code: "session/absent", cookies: [] });
    });

    /**
     * The zombie session. A realm ends an idle SSO session after thirty minutes; the cookie and the
     * row lasted eight hours, and a refused refresh used to throw without touching either — so
     * `read` went on answering the stored session and the application drew for someone the IdP had
     * already signed out.
     */
    it("ends a session the IdP refused to renew: drops the ticket and clears the cookie", async () => {
      const { store, records } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      const cookie = asRequestHeader(done.cookies);
      realm.state.refusingRefresh = true;

      const outcome = await auth.refresh(cookie);

      expect(outcome).toMatchObject({ ended: true, code: "token/refused" });
      expect(outcome.cookies[0]).toContain("__Host-kanzo-session=;");
      expect(outcome.cookies[0]).toContain("Max-Age=0");
      expect(records.size).toBe(0);
      expect(await auth.read(cookie)).toBeNull();
    });

    /**
     * The race the per-process slot cannot see: two instances behind a load balancer renew one
     * session at once, and the IdP accepts the first and refuses the second's replay of the same
     * token. The first has already written the rotated token under the shared ticket, so the
     * second reads it back and goes on with it rather than ending a session that is alive.
     */
    it("takes another process's renewal instead of ending the session on its invalid_grant", async () => {
      const backing = inMemoryAdapter();
      const store = ticketStore(backing.adapter);
      const here = relyingParty({ ...config, store });
      const { done } = await signIn(here, realm);
      const cookie = asRequestHeader(done.cookies);
      const [ticket = ""] = backing.rows.keys();
      const before = backing.rows.get(ticket) ?? null;

      // The other process: the same store, its own relying party, and it renews first.
      realm.state.refreshToken = "refresh-2";
      realm.state.accessToken = "theirs";
      alive(await relyingParty({ ...config, store }).refresh(cookie));

      // This process read the row before the other wrote it, so it spends `refresh-1` — which the
      // realm, having rotated it, now refuses.
      const read = backing.adapter.read;
      let stale = true;
      backing.adapter.read = async (key) => {
        if (!stale) return read(key);
        stale = false;
        return before;
      };
      realm.state.refusingRefresh = true;

      const outcome = alive(await here.refresh(cookie));

      expect(realm.state.posted.at(-1)?.get("refresh_token")).toBe("refresh-1");
      expect(outcome.cookies).toEqual([]);
      expect(alive<Token>(await here.token(cookie)).accessToken).toBe("theirs");
    });

    /**
     * The failure `single-flight.ts` was written for, asserted on the path that can actually cause
     * it. Ten requests noticing an expiring token in the same tick fire ten refreshes with the
     * same token under rotation, nine of which are replays of a token the first already spent —
     * and an authorization server is entitled to read that as theft and revoke the chain.
     */
    it("spends one refresh token for a burst of concurrent renewals", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);
      const cookie = asRequestHeader(done.cookies);

      const renewed = await Promise.all(Array.from({ length: 10 }, () => auth.refresh(cookie)));

      const grants = realm.state.posted.filter((body) => body.get("grant_type") === "refresh_token");
      expect(grants).toHaveLength(1);
      // And every caller was handed the cookie that one renewal issued, not nine empty answers.
      for (const one of renewed) expect(one.cookies[0]).toBe(renewed[0]?.cookies[0]);
    });

    it("keeps two people's renewals apart", async () => {
      const auth = relyingParty(config);
      const ada = await signIn(auth, realm, { sub: "ada" });
      const grace = await signIn(auth, realm, { sub: "grace" });
      const before = realm.state.posted.length;

      const [first, second] = await Promise.all([
        auth.refresh(asRequestHeader(ada.done.cookies)),
        auth.refresh(asRequestHeader(grace.done.cookies)),
      ]);

      // Two sessions, two slots, two grants. A single unkeyed slot would have made this one grant
      // and handed one of them the cookie the other was issued — silently, and only under load.
      expect(realm.state.posted.length - before).toBe(2);
      expect(first?.cookies[0]).not.toBe(second?.cookies[0]);
    });
  });

  describe("token", () => {
    /**
     * The field that was missing, and the reason it mattered: with no access token on the record a
     * product forwards the **ID token** to its resource server instead. That works on a realm that
     * happens to put the same audience in both, and stops the day the resource server checks
     * `typ == "Bearer"` — which is what it should be doing.
     */
    it("answers the access token the grant returned, and not the ID token", async () => {
      const auth = relyingParty(config);
      realm.state.accessToken = "the-access-token";
      const { done } = await signIn(auth, realm);

      const held = alive<Token>(await auth.token(asRequestHeader(done.cookies)));

      expect(held.accessToken).toBe("the-access-token");
      expect(held.session.user.id).toBe("u-1");
    });

    it("answers that there is no live session when there is no cookie", async () => {
      await expect(relyingParty(config).token(null)).resolves.toEqual({
        ended: true,
        code: "session/absent",
        cookies: [],
      });
    });

    it("clears a cookie whose ticket the store has forgotten", async () => {
      const { store, records } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      records.clear();

      const outcome = await auth.token(asRequestHeader(done.cookies));

      expect(outcome).toMatchObject({ ended: true, code: "session/absent" });
      expect(outcome.cookies[0]).toContain("Max-Age=0");
    });

    it("does not renew a token with time left on it", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      const held = await auth.token(asRequestHeader(done.cookies));

      expect(realm.state.posted).toHaveLength(1);
      // Nothing was renewed, so there is nothing to attach — and a caller that always has cookies
      // to set is a caller that stops checking.
      expect(held.cookies).toEqual([]);
    });

    it("renews a token inside the window, in place under a ticket store", async () => {
      const store = ticketStore(inMemoryAdapter().adapter);
      const auth = relyingParty({ ...config, store });
      realm.state.expiresIn = 30;
      realm.state.accessToken = "about-to-expire";
      const { done } = await signIn(auth, realm);
      const cookie = asRequestHeader(done.cookies);

      realm.state.accessToken = "renewed";
      realm.state.refreshToken = "refresh-2";
      const held = alive<Token>(await auth.token(cookie));

      expect(held.accessToken).toBe("renewed");
      expect(held.cookies).toEqual([]);
      expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");

      // And the unchanged cookie names the rotated token, so the next renewal works.
      realm.state.refreshToken = "refresh-3";
      await auth.refresh(cookie);
      expect(realm.state.posted[2]?.get("refresh_token")).toBe("refresh-2");
    });

    it("renews a token inside the window and hands back the re-sealed stateless cookie", async () => {
      const auth = relyingParty(config);
      realm.state.expiresIn = 30;
      const { done } = await signIn(auth, realm);

      realm.state.accessToken = "renewed";
      const held = alive<Token>(await auth.token(asRequestHeader(done.cookies)));

      expect(held.accessToken).toBe("renewed");
      expect(held.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
    });

    it("takes a window of its own", async () => {
      const auth = relyingParty(config);
      realm.state.expiresIn = 300;
      const { done } = await signIn(auth, realm);

      await auth.token(asRequestHeader(done.cookies), { renewWithin: 600 });

      expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");
    });

    /**
     * A realm that omits `expires_in` is one this cannot count down, and the safe direction is not
     * the obvious one: treating unknown as expired renews on *every* request, which under rotation
     * is the replay storm the single-flight slot exists to prevent, arriving one request at a time
     * where no slot can collapse it.
     */
    it("does not renew on every request when the realm gives no expiry", async () => {
      const auth = relyingParty(config);
      realm.state.expiresIn = undefined;
      const { done } = await signIn(auth, realm);

      await auth.token(asRequestHeader(done.cookies));
      await auth.token(asRequestHeader(done.cookies));

      expect(realm.state.posted).toHaveLength(1);
    });

    it("spends one refresh token for a burst of expiring requests", async () => {
      const auth = relyingParty(config);
      realm.state.expiresIn = 10;
      const { done } = await signIn(auth, realm);
      const cookie = asRequestHeader(done.cookies);

      await Promise.all(Array.from({ length: 8 }, () => auth.token(cookie)));

      const grants = realm.state.posted.filter((body) => body.get("grant_type") === "refresh_token");
      expect(grants).toHaveLength(1);
    });
  });

  describe("logout", () => {
    async function signedIn() {
      const backing = inMemoryAdapter();
      const auth = relyingParty({ ...config, store: ticketStore(backing.adapter) });
      const { done } = await signIn(auth, realm);
      return { auth, backing, cookie: asRequestHeader(done.cookies) };
    }

    it("drops the session a valid logout token names", async () => {
      const { auth, cookie } = await signedIn();

      await auth.logout(await realm.logoutToken());

      expect(await auth.read(cookie)).toBeNull();
    });

    it("drops every session of the subject when the token names no session", async () => {
      const { auth, cookie } = await signedIn();
      realm.state.sid = "sid-2";
      const { done } = await signIn(auth, realm);

      await auth.logout(await realm.logoutToken({ sid: undefined }));

      expect(await auth.read(cookie)).toBeNull();
      expect(await auth.read(asRequestHeader(done.cookies))).toBeNull();
    });

    it("leaves the person's other IdP sessions alone when it names one", async () => {
      const { auth, cookie } = await signedIn();
      realm.state.sid = "sid-2";
      const other = await signIn(auth, realm);

      await auth.logout(await realm.logoutToken({ sid: "sid-1" }));

      expect(await auth.read(cookie)).toBeNull();
      expect(await auth.read(asRequestHeader(other.done.cookies))).not.toBeNull();
    });

    it("refuses a token addressed to another client", async () => {
      const { auth, cookie } = await signedIn();

      await expect(auth.logout(await realm.logoutToken({ aud: "someone-else" }))).rejects.toMatchObject({
        code: "token/refused",
      });
      expect(await auth.read(cookie)).not.toBeNull();
    });

    /** §2.6: a `nonce` is what an ID token carries, and refusing it is what keeps one from being replayed as a logout. */
    it("refuses a token carrying a nonce", async () => {
      const { auth } = await signedIn();

      await expect(auth.logout(await realm.logoutToken({ nonce: "n" }))).rejects.toMatchObject({
        code: "token/refused",
      });
    });

    it("refuses a token without the back-channel logout event", async () => {
      const { auth } = await signedIn();

      await expect(auth.logout(await realm.logoutToken({ events: undefined }))).rejects.toMatchObject({
        code: "token/refused",
      });
      await expect(
        auth.logout(await realm.logoutToken({ events: { "http://example.test/other": {} } })),
      ).rejects.toMatchObject({ code: "token/refused" });
    });

    it("refuses a token from another issuer, or with no iat", async () => {
      const { auth } = await signedIn();

      await expect(
        auth.logout(await realm.logoutToken({ iss: "https://evil.test/realms/kanzo" })),
      ).rejects.toMatchObject({ code: "token/refused" });
      await expect(auth.logout(await realm.logoutToken({ iat: undefined }))).rejects.toMatchObject({
        code: "token/refused",
      });
    });

    it("refuses a token that names a session but no subject, which no ticket can be found by", async () => {
      const { auth, cookie } = await signedIn();

      await expect(auth.logout(await realm.logoutToken({ sub: undefined }))).rejects.toMatchObject({
        code: "token/refused",
      });
      expect(await auth.read(cookie)).not.toBeNull();
    });

    it("verifies a token signed after a key rotation, re-fetching the keys once", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        const { auth, cookie } = await signedIn();
        await expect(auth.logout(await realm.logoutToken({ sub: "nobody" }))).resolves.toBeUndefined();

        // Keycloak rotates: it signs with a key the first JWKS fetch did not contain, and publishes
        // it. `jose` re-fetches on the unknown `kid` once its cooldown has passed.
        realm.state.signingKid = "key-b";
        realm.state.publishedKids = ["key-b"];
        vi.setSystemTime(Date.now() + 31_000);

        await auth.logout(await realm.logoutToken());

        expect(await auth.read(cookie)).toBeNull();
        expect(realm.state.calls.filter((c) => c.endsWith("/certs"))).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("fetches the keys on the internal origin, as discovery does", async () => {
      const auth = relyingParty({
        ...config,
        internalOrigin: INTERNAL,
        allowInsecureHttp: true,
        store: ticketStore(inMemoryAdapter().adapter),
      });

      await auth.logout(await realm.logoutToken());

      expect(realm.state.calls).toContain("http://keycloak:8080/realms/kanzo/protocol/openid-connect/certs");
    });

    it("answers that a stateless store cannot end a session from here", async () => {
      await expect(relyingParty(config).logout(await realm.logoutToken())).rejects.toMatchObject({
        code: "session/irrevocable",
      });
    });
  });

  describe("end", () => {
    it("builds the end-session URL from discovery, with the ID token as the hint", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      const ended = await auth.end(asRequestHeader(done.cookies), {
        returnTo: "https://app.example.test/",
      });
      const url = new URL(ended.url);

      expect(url.origin + url.pathname).toBe(`${ISSUER}/protocol/openid-connect/logout`);
      expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://app.example.test/");
      // Without the hint Keycloak asks the person to confirm which session is ending.
      expect(url.searchParams.get("id_token_hint")).toBeTruthy();
      expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    });

    it("clears the session cookie and forgets the record", async () => {
      const { store, records } = recordingStore();
      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      const ended = await auth.end(asRequestHeader(done.cookies));

      expect(records.size).toBe(0);
      expect(ended.cookies[0]).toContain("__Host-kanzo-session=;");
      expect(ended.cookies[0]).toContain("Max-Age=0");
    });

    it("still ends the session at the IdP when the browser had no cookie", async () => {
      const auth = relyingParty(config);
      const ended = await auth.end(null, { returnTo: "https://app.example.test/" });

      expect(ended.url).toContain("/protocol/openid-connect/logout");
      expect(ended.cookies[0]).toContain("Max-Age=0");
    });
  });

  describe("session fixation", () => {
    it("never reads the session cookie the callback arrived with", async () => {
      // A store that records its calls, because "the callback ignores the session it was sent" is
      // a statement about what was *not* looked at, and nothing else can witness that.
      const { store, calls } = recordingStore();

      const auth = relyingParty({ ...config, store });
      const planted = await signIn(auth, realm, { sub: "attacker", preferred_username: "mallory" });

      const started = await auth.begin({ redirectUri: REDIRECT_URI });
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = {
        sub: "victim",
        nonce: new URL(started.url).searchParams.get("nonce"),
      };

      calls.length = 0;
      const done = await auth.complete({
        url: `${REDIRECT_URI}?code=the-code&state=${state}`,
        // Both the planted session and the transaction, the way a browser would send them.
        cookie: `${asRequestHeader(planted.done.cookies)}; ${asRequestHeader(started.cookies)}`,
        redirectUri: REDIRECT_URI,
      });

      // A server-side session store calls `cycle_id()` here. Ours issues a new ticket and a new
      // sealed cookie and consults the planted one for nothing at all — an attacker who put a
      // session in the browser before sign-in must not end up holding the one sign-in produced.
      expect(calls).toEqual(["put t-2"]);
      expect(done.session.user.id).toBe("victim");
      expect(await auth.read(asRequestHeader(done.cookies))).toMatchObject({
        user: { id: "victim" },
      });
      // And the planted session is still the attacker's own, not the victim's.
      expect(await auth.read(asRequestHeader(planted.done.cookies))).toMatchObject({
        user: { id: "attacker" },
      });
    });
  });

  describe("the client boundary", () => {
    it("holds no refresh token on the Session it hands out", async () => {
      const { done } = await signIn(relyingParty(config), realm);

      // The whole of the BFF pattern in one assertion: whatever the browser is given, the token
      // is not in it.
      expect(JSON.stringify(done.session)).not.toContain("refresh-1");
    });
  });
});

describe("the module boundary", () => {
  it("imports no React, no barrel and no component from the server door", async () => {
    // The defect this is watching for cost `@kanzo-tech/ui` a package: `./server` importing the
    // root barrel to reuse `claims()` would drag React into a Node process. `smoke` asserts it on
    // the built tarball; this asserts it on the source, where it is cheap enough to run always.
    const { readFile } = await import("node:fs/promises");
    // Every module specifier, however it is written — `import x from`, `export … from`, a bare
    // `import "react"`, or a dynamic `import("react")`. The first version of this regex only knew
    // the `from` spelling and a bare side-effect import walked straight past it.
    const specifiers = /(?:\bfrom|\bimport)\s*\(?\s*"([^"]+)"/g;
    const forbidden = /^(react|react-dom|react\/|\.\/index$|\.\/auth-|\.\/use-|\.\/gate)|\.tsx$/;

    // DERIVED from the entry, never listed. A hand-written roster is green about the files it
    // happens to name, and a fifth module added behind `./server` would be covered by nobody while
    // this still reported a pass — which is the "a guard that can silently not see part of its
    // corpus" failure `/docs/conventions` names, and the same walk `next.test.ts` does.
    const read = async (module: string) =>
      readFile(new URL(`${module}.ts`, import.meta.url), "utf8");
    const relatives = /(?:\bfrom|\bimport)\s*\(?\s*"(\.[^"]+)"/g;

    const reachable = new Set<string>();
    const pending = ["server"];
    while (pending.length > 0) {
      const module = pending.pop();
      if (module === undefined || reachable.has(module)) continue;
      reachable.add(module);
      for (const match of (await read(module)).matchAll(relatives)) {
        const specifier = match[1];
        if (specifier !== undefined) pending.push(specifier.replace(/^\.\//, ""));
      }
    }

    expect(reachable.size, "the walk found only the entry — it is not walking").toBeGreaterThan(3);

    for (const module of reachable) {
      const file = `${module}.ts`;
      const source = await read(module);
      // No per-file "imports nothing" floor here: the walk reaches leaves — `types.ts` imports
      // nothing and is right not to. What that floor was guarding against, reading the wrong
      // thing, is what the `reachable.size` assertion above now covers for the whole corpus.
      const imported = [...source.matchAll(specifiers)].map((m) => m[1] ?? "");
      for (const specifier of imported) {
        expect.soft(specifier, `${file} reaches past the server door`).not.toMatch(forbidden);
      }
    }
  });
});

describe("relyingParty names who did not answer", () => {
  let realm: Realm;
  let config: RelyingPartyConfig;
  /** Set to make the token endpoint fail at the transport, as the platform's fetch would. */
  let tokenEndpoint: (() => Promise<Response>) | undefined;

  beforeEach(() => {
    realm = fakeKeycloak();
    tokenEndpoint = undefined;
    const through = realm.fetchImpl;
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: SECRET,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) =>
        tokenEndpoint !== undefined && String(input).endsWith("/token")
          ? tokenEndpoint()
          : through(input, init)) as typeof globalThis.fetch,
    };
  });

  it("fails a sign-in the IdP cannot be reached for as idp/unreachable, with the cause", async () => {
    const offline = new TypeError("fetch failed");
    const auth = relyingParty({
      ...config,
      fetch: (async () => {
        throw offline;
      }) as unknown as typeof globalThis.fetch,
    });

    const failed = await auth.begin({ redirectUri: REDIRECT_URI }).catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(AuthError);
    expect(failed).toMatchObject({ code: "idp/unreachable" });
    expect((failed as AuthError).cause).toBe(offline);
  });

  it("fails a renewal the IdP did not answer in time as idp/silent, not as a refused token", async () => {
    const auth = relyingParty(config);
    const { done } = await signIn(auth, realm);
    tokenEndpoint = async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    };

    await expect(auth.refresh(asRequestHeader(done.cookies))).rejects.toMatchObject({
      code: "idp/silent",
      data: { after: 30_000 },
    });
    // And the session survives the outage: nothing was refused.
    expect(await auth.read(asRequestHeader(done.cookies))).not.toBeNull();
  });

  it("fails a renewal answered by a proxy's 502 as idp/unreachable", async () => {
    const auth = relyingParty(config);
    const { done } = await signIn(auth, realm);
    tokenEndpoint = async () => new Response("<html>Bad Gateway</html>", { status: 502 });

    await expect(auth.refresh(asRequestHeader(done.cookies))).rejects.toMatchObject({
      code: "idp/unreachable",
    });
  });

  it("ends a session on invalid_grant, and only on invalid_grant", async () => {
    const auth = relyingParty(config);
    const { done } = await signIn(auth, realm);
    tokenEndpoint = async () =>
      new Response(JSON.stringify({ error: "invalid_client" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });

    // A client the IdP does not recognise is a deployment fault, not a session that is over.
    await expect(auth.refresh(asRequestHeader(done.cookies))).rejects.toMatchObject({
      code: "token/exchange-failed",
    });

    tokenEndpoint = undefined;
    realm.state.refusingRefresh = true;
    await expect(auth.refresh(asRequestHeader(done.cookies))).resolves.toMatchObject({
      ended: true,
      code: "token/refused",
    });
  });

  it("fails a read the store cannot answer as session/unavailable, with the driver's error as the cause", async () => {
    const down = new Error("ECONNREFUSED");
    const rows = statelessStore();
    let up = true;
    const store: SessionStore = {
      ...rows,
      get: async (ticket) => {
        if (!up) throw down;
        return rows.get(ticket);
      },
    };
    const auth = relyingParty({ ...config, store });
    const { done } = await signIn(auth, realm);
    up = false;

    const failed = await auth.read(asRequestHeader(done.cookies)).catch((error: unknown) => error);

    expect(failed).toMatchObject({ code: "session/unavailable" });
    expect((failed as AuthError).cause).toBe(down);
  });
});
