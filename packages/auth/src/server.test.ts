// @vitest-environment node
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { relyingParty, type RelyingPartyConfig } from "./server";
import { statelessStore, type SessionRecord, type SessionStore } from "./store";
import { AuthError } from "./types";

const ISSUER = "https://id.example.test/realms/kanzo";
const INTERNAL = "http://keycloak:8080";
const CLIENT_ID = "keasy";
const REDIRECT_URI = "https://app.example.test/api/auth/callback";
const SECRET = "a-secret-nobody-chose-by-hand";

/** Generated once: two RSA pairs is a second of entropy, and the realm below is rebuilt per test. */
const KEYS = await Promise.all([
  generateKeyPair("RS256", { extractable: true }),
  generateKeyPair("RS256", { extractable: true }),
]);

/**
 * A Keycloak that answers on a function instead of a socket.
 *
 * Everything the flow touches is real — a real RS256 key pair, real JWTs, real JWKS selection,
 * real verification inside `openid-client`. Only the transport is ours, which is what makes these
 * assertions about our code rather than about a stub agreeing with itself.
 */
async function fakeKeycloak() {
  const [first, second] = KEYS;

  const jwk = async (key: CryptoKey, kid: string) => ({
    ...(await exportJWK(key)),
    kid,
    alg: "RS256",
    use: "sig",
  });

  const state = {
    /** Which key signs the next ID token. */
    signingKid: "key-a",
    /**
     * What the JWKS endpoint publishes, one entry per call, the last one repeating. A rotation is
     * this list disagreeing with `signingKid` for a while and then catching up.
     */
    publishedKids: ["key-a"],
    idTokenClaims: {} as Record<string, unknown>,
    refreshToken: "refresh-1",
    /** What the token endpoint hands back and for how long — both are what `token` reads. */
    accessToken: "at",
    expiresIn: 300 as number | undefined,
    /** Every request the client made, in order. */
    calls: [] as string[],
    /** Bodies posted to the token endpoint, so a test can look at what was actually sent. */
    posted: [] as URLSearchParams[],
    tokenEndpointStatus: 200,
  };

  const keyFor = (kid: string) => (kid === "key-a" ? first : second);

  const signIdToken = async () => {
    const kid = state.signingKid;
    return new SignJWT(state.idTokenClaims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keyFor(kid).privateKey);
  };

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    state.calls.push(url);

    if (url.endsWith("/.well-known/openid-configuration")) {
      return json({
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
        token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
        jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
        end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
      });
    }

    if (url.endsWith("/protocol/openid-connect/certs")) {
      const kid =
        (state.publishedKids.length > 1 ? state.publishedKids.shift() : state.publishedKids[0]) ??
        "key-a";
      return json({ keys: [await jwk(keyFor(kid).publicKey, kid)] });
    }

    if (url.endsWith("/protocol/openid-connect/token")) {
      state.posted.push(new URLSearchParams(String(init?.body ?? "")));
      if (state.tokenEndpointStatus !== 200) {
        return json({ error: "invalid_grant" }, state.tokenEndpointStatus);
      }
      return json({
        access_token: state.accessToken,
        token_type: "Bearer",
        ...(state.expiresIn === undefined ? {} : { expires_in: state.expiresIn }),
        refresh_token: state.refreshToken,
        id_token: await signIdToken(),
      });
    }

    throw new Error(`the fake realm was asked for ${url}`);
  };

  return { state, fetchImpl: fetchImpl as unknown as typeof globalThis.fetch };
}

type Realm = Awaited<ReturnType<typeof fakeKeycloak>>;

/**
 * The `Cookie` header a browser would send back from a list of `Set-Cookie` values.
 *
 * A cleared cookie is dropped rather than sent back empty, because that is what a browser does —
 * and a test that sent it back would be asserting against a request no browser makes.
 */
function asRequestHeader(cookies: readonly string[]): string {
  return cookies
    .filter((c) => !c.includes("Max-Age=0"))
    .map((c) => c.slice(0, c.indexOf(";")))
    .join("; ");
}

/** Walk one sign-in: begin, answer as Keycloak would, complete. */
async function signIn(
  auth: ReturnType<typeof relyingParty>,
  realm: Realm,
  claims: Record<string, unknown> = { sub: "u-1", preferred_username: "ada" },
  options: { readonly returnTo?: string } = {},
) {
  const started = await auth.begin(options);
  const sent = new URL(started.url);
  const state = sent.searchParams.get("state") ?? "";
  realm.state.idTokenClaims = { nonce: sent.searchParams.get("nonce"), ...claims };

  const done = await auth.complete({
    url: `${REDIRECT_URI}?code=the-code&state=${state}`,
    cookie: asRequestHeader(started.cookies),
  });
  return { started, sent, state, done };
}

describe("relyingParty", () => {
  let realm: Realm;
  let config: RelyingPartyConfig;

  beforeEach(async () => {
    realm = await fakeKeycloak();
    config = {
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      redirectUri: REDIRECT_URI,
      secret: SECRET,
      fetch: realm.fetchImpl,
    };
  });

  describe("begin", () => {
    it("sends the browser to the authorization endpoint with PKCE, state and nonce", async () => {
      const { url, cookies } = await relyingParty(config).begin();
      const sent = new URL(url);

      expect(sent.origin + sent.pathname).toBe(`${ISSUER}/protocol/openid-connect/auth`);
      expect(sent.searchParams.get("client_id")).toBe(CLIENT_ID);
      expect(sent.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
      expect(sent.searchParams.get("code_challenge_method")).toBe("S256");
      expect(sent.searchParams.get("code_challenge")).toBeTruthy();
      expect(sent.searchParams.get("state")).toBeTruthy();
      expect(sent.searchParams.get("nonce")).toBeTruthy();
      expect(sent.searchParams.get("scope")).toBe("openid profile email");

      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.startsWith("__Host-kanzo-auth=")).toBe(true);
    });

    it("keeps the verifier off the wire", async () => {
      const { url, cookies } = await relyingParty(config).begin();

      // The challenge goes to Keycloak; the verifier stays with us, sealed. Sending both is the
      // mistake PKCE exists to prevent, and it is one field away.
      const challenge = new URL(url).searchParams.get("code_challenge") ?? "";
      expect(url).not.toContain("code_verifier");
      expect(cookies[0]).not.toContain(challenge);
    });

    it("asks for one organization's scope when told which", async () => {
      const { url } = await relyingParty(config).begin({ organization: "acme" });

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

      await expect(auth.begin({ organization: "acme offline_access" })).rejects.toMatchObject({
        code: "organization.invalid",
      });
      await expect(auth.begin({ organization: "acme\toffline_access" })).rejects.toMatchObject({
        code: "organization.invalid",
      });
      await expect(auth.begin({ organization: "" })).rejects.toMatchObject({
        code: "organization.invalid",
      });
      await expect(auth.begin({ organization: "acme:*" })).rejects.toMatchObject({
        code: "organization.invalid",
      });
    });

    it("still takes the aliases a realm actually mints, and the star", async () => {
      const auth = relyingParty(config);

      for (const alias of ["acme", "beta-labs", "a.b_c-9", "*"]) {
        const { url } = await auth.begin({ organization: alias });
        expect(new URL(url).searchParams.get("scope")).toBe(
          `openid profile email organization:${alias}`,
        );
      }
    });

    it("reaches Keycloak on the internal origin while sending the browser to the public one", async () => {
      const { url } = await relyingParty({ ...config, internalOrigin: INTERNAL }).begin();

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
        resource_access: { keasy: { roles: ["owner"] } },
        organization: { acme: { id: "org-1", groups: ["/keasy/owner", "/hub/reader"] } },
      });

      expect(done.session.user).toEqual({
        id: "u-1",
        email: "ada@example.test",
        name: "Ada Lovelace",
        username: "ada",
      });
      expect(done.session.roles).toEqual(["default-roles", "owner"]);
      // `/hub/reader` is another application's role and must not arrive here — `claims.ts` does
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

    it("issues a session cookie and clears the transaction one", async () => {
      const { done } = await signIn(relyingParty(config), realm);

      expect(done.cookies).toHaveLength(2);
      expect(done.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
      expect(done.cookies[1]).toContain("__Host-kanzo-auth=;");
      expect(done.cookies[1]).toContain("Max-Age=0");
    });

    it("returns where the person was going", async () => {
      const { done } = await signIn(relyingParty(config), realm, undefined, { returnTo: "/jobs/7" });

      expect(done.returnTo).toBe("/jobs/7");
    });

    it("refuses a callback whose state is not the one it sent", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();

      const refused = auth.complete({
        url: `${REDIRECT_URI}?code=the-code&state=someone-elses-state`,
        cookie: asRequestHeader(started.cookies),
      });

      await expect(refused).rejects.toThrow(AuthError);
      await expect(refused).rejects.toMatchObject({ code: "callback.state-mismatch" });
      // And nothing was spent: the code never reached the token endpoint.
      expect(realm.state.posted).toHaveLength(0);
    });

    it("refuses a callback with no state at all", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code`,
          cookie: asRequestHeader(started.cookies),
        }),
      ).rejects.toMatchObject({ code: "callback.state-mismatch" });
    });

    it("refuses a callback with no transaction cookie", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");

      // A bookmarked callback, a cookie that expired while the person read the consent screen, or
      // a code delivered to a browser that never started the flow. All the same answer.
      await expect(
        auth.complete({ url: `${REDIRECT_URI}?code=the-code&state=${state}`, cookie: null }),
      ).rejects.toMatchObject({ code: "callback.state-mismatch" });
    });

    it("refuses a transaction cookie sealed by somebody else", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");

      const forged = await relyingParty({ ...config, secret: "not-our-secret" }).begin();

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(forged.cookies),
        }),
      ).rejects.toMatchObject({ code: "callback.state-mismatch" });
    });

    it("refuses an ID token whose nonce is not the one it sent", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");
      // A replayed authorization response: the state is this transaction's, the ID token is from
      // another one. Only the nonce tells them apart.
      realm.state.idTokenClaims = { sub: "u-1", nonce: "a-nonce-from-another-sign-in" };

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
        }),
      ).rejects.toMatchObject({ code: "callback.nonce-mismatch" });
    });

    it("refuses an ID token with no nonce at all", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = { sub: "u-1" };

      // This is the test that pins a message match — see `isNonceMismatch`. If `oauth4webapi`
      // rewords that line, the failure belongs here, not in a production log where a replay has
      // quietly become "the token endpoint misbehaved".
      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
        }),
      ).rejects.toMatchObject({ code: "callback.nonce-mismatch" });
    });

    it("reports a refused token endpoint as an exchange failure", async () => {
      const auth = relyingParty(config);
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");
      realm.state.tokenEndpointStatus = 400;

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
        }),
      ).rejects.toMatchObject({ code: "token.exchange-failed" });
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
      const started = await auth.begin();
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
      });

      expect(done.session.user.id).toBe("u-1");
      expect(discoveries()).toBe(2);
    });

    it("gives up after one retry rather than hammering the identity provider", async () => {
      const auth = relyingParty({ ...config, verifySignatures: true });
      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = { sub: "u-1", nonce: new URL(started.url).searchParams.get("nonce") };
      // The rotation never lands: the realm goes on signing with a key it never publishes.
      realm.state.signingKid = "key-b";
      realm.state.publishedKids = ["key-a"];

      await expect(
        auth.complete({
          url: `${REDIRECT_URI}?code=the-code&state=${state}`,
          cookie: asRequestHeader(started.cookies),
        }),
      ).rejects.toMatchObject({ code: "token.exchange-failed" });

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
      const records = new Map<string, SessionRecord>();
      let next = 0;
      const store: SessionStore = {
        async put(record) {
          const ticket = `t-${++next}`;
          records.set(ticket, record);
          return ticket;
        },
        async get(ticket) {
          return records.get(ticket) ?? null;
        },
        async drop(ticket) {
          records.delete(ticket);
        },
      };

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
    it("spends the refresh token, takes the rotated one, and reissues the cookie", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      realm.state.refreshToken = "refresh-2";
      const renewed = await auth.refresh(asRequestHeader(done.cookies));

      expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");
      expect(realm.state.posted[1]?.get("refresh_token")).toBe("refresh-1");
      expect(renewed.session.user.id).toBe("u-1");
      expect(renewed.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);

      // The new cookie must carry the rotated token; keeping the spent one is how a session dies
      // on its next renewal.
      realm.state.refreshToken = "refresh-3";
      await auth.refresh(asRequestHeader(renewed.cookies));
      expect(realm.state.posted[2]?.get("refresh_token")).toBe("refresh-2");
    });

    it("drops the superseded ticket before issuing the next", async () => {
      const dropped: string[] = [];
      const inner = statelessStore();
      const store: SessionStore = {
        put: (record) => inner.put(record),
        get: (ticket) => inner.get(ticket),
        async drop(ticket) {
          dropped.push(ticket);
        },
      };

      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      await auth.refresh(asRequestHeader(done.cookies));

      expect(dropped).toHaveLength(1);
    });

    it("refuses when there is no session to renew", async () => {
      const auth = relyingParty(config);

      await expect(auth.refresh(null)).rejects.toMatchObject({ code: "session.absent" });
    });

    it("reports a refused refresh, which under rotation is often a replay", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);
      realm.state.tokenEndpointStatus = 400;

      await expect(auth.refresh(asRequestHeader(done.cookies))).rejects.toMatchObject({
        code: "token.exchange-failed",
      });
    });

    /**
     * The failure `single-flight.ts` was written for, asserted on the path that can actually cause
     * it. Ten requests noticing an expiring token in the same tick fire ten refreshes with the
     * same token under rotation, nine of which are replays of a token the first already spent —
     * and an authorization server is entitled to read that as theft and revoke the chain. Before
     * this, the primitive existed and nothing on this path called it.
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

      const held = await auth.token(asRequestHeader(done.cookies));

      expect(held?.accessToken).toBe("the-access-token");
      expect(held?.session.user.id).toBe("u-1");
    });

    it("answers null when there is no session", async () => {
      await expect(relyingParty(config).token(null)).resolves.toBeNull();
    });

    it("does not renew a token with time left on it", async () => {
      const auth = relyingParty(config);
      const { done } = await signIn(auth, realm);

      const held = await auth.token(asRequestHeader(done.cookies));

      expect(realm.state.posted).toHaveLength(1);
      // Nothing was renewed, so there is nothing to attach — and a caller that always has cookies
      // to set is a caller that stops checking.
      expect(held?.cookies).toEqual([]);
    });

    /**
     * The seven hours the host measured: a cookie good for eight and a token good for one. This is
     * the line where they stop being two clocks with nothing between them.
     */
    it("renews a token inside the window and hands back the cookie to set", async () => {
      const auth = relyingParty(config);
      realm.state.expiresIn = 30;
      realm.state.accessToken = "about-to-expire";
      const { done } = await signIn(auth, realm);

      realm.state.accessToken = "renewed";
      realm.state.refreshToken = "refresh-2";
      const held = await auth.token(asRequestHeader(done.cookies));

      expect(held?.accessToken).toBe("renewed");
      expect(held?.cookies[0]?.startsWith("__Host-kanzo-session=")).toBe(true);
      expect(realm.state.posted[1]?.get("grant_type")).toBe("refresh_token");

      // And the cookie it handed back carries the rotated token, so the next renewal works.
      realm.state.refreshToken = "refresh-3";
      await auth.refresh(asRequestHeader(held?.cookies ?? []));
      expect(realm.state.posted[2]?.get("refresh_token")).toBe("refresh-2");
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
      const dropped: string[] = [];
      const inner = statelessStore();
      const store: SessionStore = {
        put: (record) => inner.put(record),
        get: (ticket) => inner.get(ticket),
        async drop(ticket) {
          dropped.push(ticket);
        },
      };

      const auth = relyingParty({ ...config, store });
      const { done } = await signIn(auth, realm);
      const ended = await auth.end(asRequestHeader(done.cookies));

      expect(dropped).toHaveLength(1);
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
      // A store that records its reads, because "the callback ignores the session it was sent" is
      // a statement about what was *not* looked at, and nothing else can witness that.
      const reads: string[] = [];
      const records = new Map<string, SessionRecord>();
      let next = 0;
      const store: SessionStore = {
        async put(record) {
          const ticket = `t-${++next}`;
          records.set(ticket, record);
          return ticket;
        },
        async get(ticket) {
          reads.push(ticket);
          return records.get(ticket) ?? null;
        },
        async drop(ticket) {
          records.delete(ticket);
        },
      };

      const auth = relyingParty({ ...config, store });
      const planted = await signIn(auth, realm, { sub: "attacker", preferred_username: "mallory" });

      const started = await auth.begin();
      const state = new URL(started.url).searchParams.get("state");
      realm.state.idTokenClaims = {
        sub: "victim",
        nonce: new URL(started.url).searchParams.get("nonce"),
      };

      reads.length = 0;
      const done = await auth.complete({
        url: `${REDIRECT_URI}?code=the-code&state=${state}`,
        // Both the planted session and the transaction, the way a browser would send them.
        cookie: `${asRequestHeader(planted.done.cookies)}; ${asRequestHeader(started.cookies)}`,
      });

      // keasy's Rust calls `cycle_id()` here. Ours issues a new ticket and a new sealed cookie and
      // consults the planted one for nothing at all — an attacker who put a session in the browser
      // before sign-in must not end up holding the one sign-in produced.
      expect(reads).toEqual([]);
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
