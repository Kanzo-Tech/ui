// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cookieValue, sealedCookie } from "./cookie-session";

const SECRET = "a-secret-nobody-chose-by-hand";

interface Payload {
  readonly who: string;
  readonly roles: readonly string[];
}

/** The token out of a `Set-Cookie` header, the way a browser would take it. */
function token(setCookie: string): string {
  const value = setCookie.slice(0, setCookie.indexOf(";"));
  return value.slice(value.indexOf("=") + 1);
}

/** What the browser would send back on the next request. */
function asRequestHeader(setCookie: string): string {
  return setCookie.slice(0, setCookie.indexOf(";"));
}

describe("sealedCookie", () => {
  it("round-trips a value through the cookie", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const header = await cookie.seal({ who: "u-1", roles: ["owner"] });

    expect(await cookie.read(asRequestHeader(header))).toEqual({ who: "u-1", roles: ["owner"] });
  });

  it("carries the __Host- prefix and the attributes it forces", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    expect(cookie.name).toBe("__Host-kanzo-session");

    const header = await cookie.seal({ who: "u-1", roles: [] });
    expect(header.startsWith("__Host-kanzo-session=")).toBe(true);
    // `__Host-` is only honoured with all three, and a browser silently ignores the cookie
    // otherwise — which is a sign-in that appears to work and a session that never arrives.
    expect(header).toContain("; Path=/");
    expect(header).toContain("; Secure");
    expect(header).toContain("; HttpOnly");
    expect(header).not.toContain("Domain");
  });

  it("sets SameSite=Lax, because Strict withholds the cookie on the callback's return", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-auth", secret: SECRET, maxAge: 60 });
    const header = await cookie.seal({ who: "u-1", roles: [] });

    expect(header).toContain("; SameSite=Lax");
    expect(header).not.toContain("SameSite=Strict");
  });

  it("does not put the value in the clear", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const header = await cookie.seal({ who: "sub-9f3c", roles: ["owner"] });

    expect(header).not.toContain("sub-9f3c");
    expect(header).not.toContain("owner");
  });

  it("refuses a cookie tampered with in flight", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const sealed = token(await cookie.seal({ who: "u-1", roles: [] }));

    // A JWE is five dot-separated parts; flipping a character of the ciphertext is the attack this
    // has to survive, and AEAD is what makes it fail to decrypt rather than decrypt to something.
    const parts = sealed.split(".");
    expect(parts).toHaveLength(5);
    const ciphertext = parts[3] ?? "";
    parts[3] = (ciphertext[0] === "A" ? "B" : "A") + ciphertext.slice(1);

    expect(await cookie.read(`__Host-kanzo-session=${parts.join(".")}`)).toBeNull();
  });

  it("refuses every other part of a tampered cookie too", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const sealed = token(await cookie.seal({ who: "u-1", roles: [] }));
    const parts = sealed.split(".");

    // The header, the initialisation vector and the authentication tag. A guard that only watched
    // the ciphertext would pass this file and still let a re-tagged cookie through.
    for (const index of [0, 2, 4]) {
      const original = parts[index] ?? "";
      const broken = [...parts];
      broken[index] = (original[0] === "A" ? "B" : "A") + original.slice(1);
      expect(await cookie.read(`__Host-kanzo-session=${broken.join(".")}`)).toBeNull();
    }
  });

  it("refuses a cookie sealed with another secret", async () => {
    const ours = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const theirs = sealedCookie<Payload>({ name: "kanzo-session", secret: "some-other", maxAge: 60 });
    const forged = await theirs.seal({ who: "root", roles: ["owner"] });

    expect(await ours.read(asRequestHeader(forged))).toBeNull();
  });

  it("refuses a cookie whose sealed lifetime has run out", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: -1 });
    const header = await cookie.seal({ who: "u-1", roles: [] });

    // `Max-Age` is the browser's copy of the deadline and a request can simply not honour it; the
    // `exp` inside the JWE is the one the server enforces, which is why they are one number.
    expect(await cookie.read(asRequestHeader(header))).toBeNull();
  });

  it("answers null for an absent cookie and for no header at all", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });

    expect(await cookie.read(null)).toBeNull();
    expect(await cookie.read(undefined)).toBeNull();
    expect(await cookie.read("")).toBeNull();
    expect(await cookie.read("other=1; another=2")).toBeNull();
  });

  it("reads its own cookie out of a header carrying several", async () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const mine = asRequestHeader(await cookie.seal({ who: "u-1", roles: [] }));

    expect(await cookie.read(`theme=dark; ${mine}; locale=es`)).toEqual({ who: "u-1", roles: [] });
  });

  it("clears with an expiring cookie of the same name", () => {
    const cookie = sealedCookie<Payload>({ name: "kanzo-session", secret: SECRET, maxAge: 60 });
    const header = cookie.clear();

    expect(header.startsWith("__Host-kanzo-session=;")).toBe(true);
    expect(header).toContain("Max-Age=0");
    // The clearing cookie must carry the same attributes or the browser keeps the original.
    expect(header).toContain("; Path=/");
    expect(header).toContain("; Secure");
  });

  it("refuses to emit a cookie a browser would silently drop", async () => {
    const cookie = sealedCookie<{ padding: string }>({
      name: "kanzo-session",
      secret: SECRET,
      maxAge: 60,
    });

    // Two Keycloak JWTs in one cookie is roughly this much, which is the failure `SessionStore`
    // exists for: over 4 KB the browser keeps nothing and nothing reports it.
    await expect(cookie.seal({ padding: "x".repeat(5000) })).rejects.toThrow(/SessionStore/);
  });
});

describe("cookieValue", () => {
  it("reads one name out of a Cookie header", () => {
    expect(cookieValue("a=1; b=2; c=3", "b")).toBe("2");
    expect(cookieValue("a=1", "b")).toBeUndefined();
    expect(cookieValue(null, "b")).toBeUndefined();
  });

  it("does not match a name by prefix", () => {
    // `session` and `session-old` are different cookies, and an `indexOf`-shaped reader confuses
    // them — which would hand the reader a value sealed for something else.
    expect(cookieValue("session-old=stale; session=fresh", "session")).toBe("fresh");
  });
});
