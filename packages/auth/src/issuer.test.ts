// @vitest-environment node
import { describe, expect, it } from "vitest";
import { issuer, rewriteOrigin } from "./issuer";

const PUBLIC_ISSUER = "https://id.example.test/realms/kanzo";
const INTERNAL = "http://keycloak:8080";

/** What Keycloak serves at `/.well-known/openid-configuration`, trimmed to what is read here. */
function metadata(iss = PUBLIC_ISSUER): Record<string, unknown> {
  return {
    issuer: iss,
    authorization_endpoint: `${iss}/protocol/openid-connect/auth`,
    token_endpoint: `${iss}/protocol/openid-connect/token`,
    jwks_uri: `${iss}/protocol/openid-connect/certs`,
    end_session_endpoint: `${iss}/protocol/openid-connect/logout`,
    response_types_supported: ["code"],
  };
}

function discoveryFetch(document = metadata()) {
  const seen: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    seen.push(String(input));
    return new Response(JSON.stringify(document), {
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof globalThis.fetch;
  return { seen, fetchImpl };
}

/** A `fetch` that only remembers where it was asked to go. */
function recordingFetch() {
  const seen: string[] = [];
  const impl = (async (url: string) => {
    seen.push(url);
    return new Response("{}");
  }) as unknown as typeof globalThis.fetch;
  return { seen, impl };
}

describe("rewriteOrigin", () => {
  it("replaces the origin and leaves everything after it alone", async () => {
    const { seen, impl } = recordingFetch();
    const rewritten = rewriteOrigin(PUBLIC_ISSUER, INTERNAL, impl);

    await rewritten(`${PUBLIC_ISSUER}/protocol/openid-connect/token?x=1`, {
      body: null,
      headers: {},
      method: "POST",
      redirect: "manual",
    });

    expect(seen[0]).toBe(
      "http://keycloak:8080/realms/kanzo/protocol/openid-connect/token?x=1",
    );
  });

  it("leaves a URL from another origin untouched", async () => {
    const { seen, impl } = recordingFetch();
    const rewritten = rewriteOrigin(PUBLIC_ISSUER, INTERNAL, impl);

    await rewritten("https://elsewhere.test/a", {
      body: null,
      headers: {},
      method: "GET",
      redirect: "manual",
    });

    expect(seen[0]).toBe("https://elsewhere.test/a");
  });

  it("tolerates a trailing slash on the internal origin", async () => {
    const { seen, impl } = recordingFetch();
    const rewritten = rewriteOrigin(PUBLIC_ISSUER, `${INTERNAL}/`, impl);

    await rewritten(`${PUBLIC_ISSUER}/a`, {
      body: null,
      headers: {},
      method: "GET",
      redirect: "manual",
    });

    expect(seen[0]).toBe("http://keycloak:8080/realms/kanzo/a");
  });
});

describe("issuer", () => {
  it("fetches discovery from the internal origin while the issuer stays public", async () => {
    const { seen, fetchImpl } = discoveryFetch();

    const configuration = await issuer({
      issuer: PUBLIC_ISSUER,
      clientId: "keasy",
      clientSecret: "s",
      internalOrigin: INTERNAL,
      fetch: fetchImpl,
    }).configuration();

    // The request went to the cluster. The document it answered with still names the public
    // issuer, and openid-client validated *that* — which is the whole reason the rewrite belongs
    // on the transport rather than on the issuer URL.
    expect(seen).toEqual([
      "http://keycloak:8080/realms/kanzo/.well-known/openid-configuration",
    ]);
    expect(configuration.serverMetadata().issuer).toBe(PUBLIC_ISSUER);
  });

  it("goes to the public origin when no internal one is configured", async () => {
    const { seen, fetchImpl } = discoveryFetch();

    await issuer({
      issuer: PUBLIC_ISSUER,
      clientId: "keasy",
      clientSecret: "s",
      fetch: fetchImpl,
    }).configuration();

    expect(seen).toEqual([
      "https://id.example.test/realms/kanzo/.well-known/openid-configuration",
    ]);
  });

  it("discovers once and reuses it", async () => {
    const { seen, fetchImpl } = discoveryFetch();
    const provider = issuer({ issuer: PUBLIC_ISSUER, clientId: "keasy", fetch: fetchImpl });

    const [a, b] = await Promise.all([provider.configuration(), provider.configuration()]);
    await provider.configuration();

    expect(seen).toHaveLength(1);
    expect(a).toBe(b);
  });

  it("lets the caller drive the retry when Keycloak is not up yet", async () => {
    let up = false;
    const fetchImpl = (async () => {
      if (!up) throw new TypeError("fetch failed");
      return new Response(JSON.stringify(metadata()), {
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof globalThis.fetch;

    const provider = issuer({ issuer: PUBLIC_ISSUER, clientId: "keasy", fetch: fetchImpl });

    await expect(provider.configuration()).rejects.toThrow();

    // Nothing was cached and no loop was started: the *next* await is the retry, on the caller's
    // schedule. A library that retried in the background would have taken that decision away.
    up = true;
    expect((await provider.configuration()).serverMetadata().issuer).toBe(PUBLIC_ISSUER);
  });

  it("rediscovers on demand, which is the answer to key rotation", async () => {
    const { seen, fetchImpl } = discoveryFetch();
    const provider = issuer({ issuer: PUBLIC_ISSUER, clientId: "keasy", fetch: fetchImpl });

    const first = await provider.configuration();
    const second = await provider.rediscover();

    expect(seen).toHaveLength(2);
    // A new Configuration, because openid-client caches the JWKS inside the old one — keeping it
    // would mean rediscovering the metadata and re-reading the same stale keys.
    expect(second).not.toBe(first);
    expect(await provider.configuration()).toBe(second);
  });

  it("refuses a plain-HTTP issuer unless it is allowed", async () => {
    const insecure = "http://localhost:8080/realms/kanzo";
    const { fetchImpl } = discoveryFetch(metadata(insecure));

    await expect(
      issuer({ issuer: insecure, clientId: "keasy", fetch: fetchImpl }).configuration(),
    ).rejects.toThrow();

    // And allows it when asked, because a compose file on a laptop serves exactly this.
    const allowed = await issuer({
      issuer: insecure,
      clientId: "keasy",
      fetch: fetchImpl,
      allowInsecureHttp: true,
    }).configuration();
    expect(allowed.serverMetadata().issuer).toBe(insecure);
  });
});
