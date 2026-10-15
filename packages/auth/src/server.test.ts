// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Problem } from "@kanzo-tech/kernel";
import { sessionReader } from "./server";
import { CLIENT_ID, ISSUER, JWKS, localRealm, type Realm } from "./test/realm";

/** The headers a request carries once the edge has let it through. */
function through(token: string, extra: Record<string, string> = {}): Headers {
  return new Headers({ "x-forwarded-access-token": token, ...extra });
}

describe("sessionReader", () => {
  let realm: Realm;
  let read: (headers: Headers) => Promise<unknown>;

  beforeEach(async () => {
    realm = await localRealm();
    vi.stubGlobal("fetch", realm.fetch());
    read = sessionReader({ issuer: ISSUER, clientId: CLIENT_ID, jwks: JWKS });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the person a verified token names into a Session, organizations and roles inside them", async () => {
    const token = await realm.sign({
      email: "ana@acme.test",
      name: "Ana",
      realm_access: { roles: ["auditor"] },
      organization: { acme: { id: "a-1", resource_access: { [CLIENT_ID]: { roles: ["owner"] } } } },
    });

    expect(await read(through(token))).toMatchObject({
      user: { id: "u-1", email: "ana@acme.test", name: "Ana" },
      roles: ["auditor"],
      organizations: [{ alias: "acme", id: "a-1", roles: ["owner"], groups: [], groupsOverage: false }],
    });
  });

  it("has no session when the edge forwarded no token", async () => {
    expect(await read(new Headers())).toBeNull();
    expect(await read(through(""))).toBeNull();
  });

  /**
   * `X-Forwarded-User` and `X-Forwarded-Email` are the edge's unsigned word. Whoever can set a
   * header can set them, and the token says the same with the realm's signature on it.
   */
  it("reads who the person is from the token, never from the edge's unsigned headers", async () => {
    const token = await realm.sign({ email: "ana@acme.test" });

    const session = await read(through(token, { "x-forwarded-user": "u-2", "x-forwarded-email": "eve@evil.test" }));

    expect(session).toMatchObject({ user: { id: "u-1", email: "ana@acme.test" } });
  });

  /** `azp` names the client the token was issued to: another application's token is not ours. */
  it("refuses a token issued to another client, as token/refused", async () => {
    const token = await realm.sign({ azp: "ledger" });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused", status: 401 });
  });

  /** Keycloak signs its ID tokens with the same keys and for the same `azp`; only `typ` tells them apart. */
  it("refuses an ID token, as token/refused", async () => {
    const token = await realm.sign({ typ: "ID" });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused", status: 401 });
  });

  it("refuses a token another issuer signed for, as token/refused", async () => {
    const token = await realm.sign({ iss: "https://id.example.test/realms/other" });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused" });
  });

  it("refuses an expired token, as token/refused", async () => {
    const token = await realm.sign({ exp: Math.floor(Date.now() / 1000) - 1 });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused" });
  });

  it("refuses a token with no expiry, as token/refused", async () => {
    const token = await realm.sign({ exp: undefined });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused" });
  });

  /**
   * A header is anyone's to write, and a token is only the realm's to sign: this is the line that
   * makes a header that did not come through the edge worth nothing.
   */
  it("refuses a token signed by a key that is not the realm's, as token/refused", async () => {
    const token = await realm.sign({}, { by: "stranger" });

    await expect(read(through(token))).rejects.toMatchObject({ code: "token/refused" });
  });

  it("refuses an unsigned token, as token/refused", async () => {
    const [, payload] = (await realm.sign()).split(".");
    const unsigned = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${payload}.`;

    await expect(read(through(unsigned))).rejects.toMatchObject({ code: "token/refused" });
    await expect(read(through("not a token"))).rejects.toMatchObject({ code: "token/refused" });
  });

  /**
   * The realm being down is not the token being wrong: one is an outage to show as one, the other
   * a refusal. Reading both as `token/refused` would send a person to sign in over an outage.
   */
  it("names the realm unreachable, not the token refused, when its keys cannot be fetched", async () => {
    const token = await realm.sign();
    const offline = new TypeError("fetch failed");
    vi.stubGlobal("fetch", async () => {
      throw offline;
    });

    const failed = await read(through(token)).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(Problem);
    expect(failed).toMatchObject({ code: "idp/unreachable", status: 502 });
    expect((failed as Problem).cause).toBe(offline);

    vi.stubGlobal("fetch", async () => new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(sessionReader({ issuer: ISSUER, clientId: CLIENT_ID, jwks: JWKS })(through(token))).rejects.toMatchObject({
      code: "idp/unreachable",
    });
  });

  it("reaches the keys at the issuer's own address unless told where this process reaches them", async () => {
    vi.stubGlobal("fetch", realm.fetch(undefined, `${ISSUER}/protocol/openid-connect/certs`));
    const token = await realm.sign();

    expect(await sessionReader({ issuer: `${ISSUER}/`, clientId: CLIENT_ID })(through(token))).not.toBeNull();
  });

  it("fetches the realm's keys once for many reads", async () => {
    const keys = vi.fn(realm.fetch());
    vi.stubGlobal("fetch", keys);
    const fresh = sessionReader({ issuer: ISSUER, clientId: CLIENT_ID, jwks: JWKS });

    for (let i = 0; i < 3; i++) await fresh(through(await realm.sign()));

    expect(keys).toHaveBeenCalledTimes(1);
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
