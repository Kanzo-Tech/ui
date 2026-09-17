// @vitest-environment node
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "./next-middleware";
import { authRoutes } from "./next-routes";

const ORIGIN = "https://app.example.test";
const ISSUER = "https://id.example.test/realms/kanzo";
const CLIENT_ID = "keasy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(
    new Request(`${ORIGIN}${path}`, cookie === undefined ? {} : { headers: { cookie } }),
  );
}

/** `NextResponse.next()` is how middleware says "carry on", and this header is how it says it. */
function passedThrough(response: { headers: Headers }): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("authMiddleware", () => {
  const middleware = authMiddleware({ public: ["/health"] });

  it("redirects an anonymous request, carrying where it was going", () => {
    const response = middleware(request("/dashboard?tab=jobs"));
    const away = new URL(response.headers.get("location") ?? "");

    expect(response.status).toBe(307);
    expect(away.pathname).toBe("/api/auth/signin");
    expect(away.searchParams.get("returnTo")).toBe("/dashboard?tab=jobs");
  });

  it("lets a request with the session cookie through", () => {
    expect(passedThrough(middleware(request("/dashboard", "__Host-kanzo-session=sealed")))).toBe(
      true,
    );
  });

  it("lets a public prefix through, and only on a segment boundary", () => {
    expect(passedThrough(middleware(request("/health")))).toBe(true);
    expect(passedThrough(middleware(request("/health/live")))).toBe(true);
    // A plain `startsWith` would open this one, and nobody wrote it down as public.
    expect(passedThrough(middleware(request("/healthcare")))).toBe(false);
  });

  it("lets the auth routes through, or nobody could ever sign in", () => {
    expect(passedThrough(middleware(request("/api/auth/signin")))).toBe(true);
    expect(passedThrough(middleware(request("/api/auth/callback?code=x")))).toBe(true);
  });

  /** The path exemption `isFile` makes, and the incident `next-middleware.ts`'s header records. */
  it("never redirects a static file, whatever the matcher lets in", () => {
    expect(passedThrough(middleware(request("/fossil/fossil_wasm_bg.wasm")))).toBe(true);
    expect(passedThrough(middleware(request("/favicon.ico")))).toBe(true);
    expect(passedThrough(middleware(request("/logo.svg")))).toBe(true);
  });

  it("honours a basePath, for both the exemption and the redirect", () => {
    const mounted = authMiddleware({ basePath: "/v1/auth" });

    expect(passedThrough(mounted(request("/v1/auth/signin")))).toBe(true);
    expect(new URL(mounted(request("/x")).headers.get("location") ?? "").pathname).toBe(
      "/v1/auth/signin",
    );
  });

  /**
   * The tie between `SESSION_COOKIE` and the name `relyingParty` really issues, which is what the
   * second copy of that string owes: sign in for real, then let the middleware read the cookie the
   * sign-in produced, under its own default.
   */
  it("defaults to the cookie name relyingParty actually issues", async () => {
    const key = await generateKeyPair("RS256", { extractable: true });
    let nonce: string | null = null;

    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

    const realm = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith("/.well-known/openid-configuration")) {
        return json({
          issuer: ISSUER,
          authorization_endpoint: `${ISSUER}/protocol/openid-connect/auth`,
          token_endpoint: `${ISSUER}/protocol/openid-connect/token`,
          jwks_uri: `${ISSUER}/protocol/openid-connect/certs`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
        });
      }
      if (url.endsWith("/protocol/openid-connect/certs")) {
        return json({
          keys: [{ ...(await exportJWK(key.publicKey)), kid: "k", alg: "RS256", use: "sig" }],
        });
      }
      return json({
        access_token: "at",
        token_type: "Bearer",
        expires_in: 300,
        id_token: await new SignJWT({ sub: "u-1", nonce })
          .setProtectedHeader({ alg: "RS256", kid: "k" })
          .setIssuer(ISSUER)
          .setAudience(CLIENT_ID)
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(key.privateKey),
      });
    }) as unknown as typeof globalThis.fetch;

    const routes = authRoutes({
      issuer: ISSUER,
      clientId: CLIENT_ID,
      clientSecret: "client-secret",
      secret: "a-secret-nobody-chose-by-hand",
      fetch: realm,
    });

    const started = await routes.GET(new Request(`${ORIGIN}/api/auth/signin`));
    const away = new URL(started.headers.get("location") ?? "");
    nonce = away.searchParams.get("nonce");

    const done = await routes.GET(
      new Request(`${ORIGIN}/api/auth/callback?code=c&state=${away.searchParams.get("state")}`, {
        headers: {
          cookie: started.headers
            .getSetCookie()
            .map((c) => c.slice(0, c.indexOf(";")))
            .join("; "),
        },
      }),
    );

    const issued = done.headers
      .getSetCookie()
      .filter((c) => !c.includes("Max-Age=0"))
      .map((c) => c.slice(0, c.indexOf(";")))
      .join("; ");
    expect(issued).not.toBe("");

    expect(passedThrough(authMiddleware()(request("/dashboard", issued)))).toBe(true);
  });
});
