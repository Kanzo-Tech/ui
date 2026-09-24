import { EncryptJWT, jwtDecrypt } from "jose";

/**
 * A value sealed into a cookie, and read back out of one.
 *
 * There is **one** mechanism here and it is used twice: for the session that outlives a request,
 * and for the short-lived transaction that carries `state`, `nonce` and the PKCE verifier between
 * the two legs of the authorization code flow. Holding the transaction in a cookie rather than in
 * server memory is what makes the BFF stateless by default — keasy's Rust keeps those three in a
 * SQLite-backed server session, and pays for a session store before anyone has signed in.
 *
 * ## The attributes, and why each one
 *
 * - **`__Host-` prefix**, added here and not declinable. It forces `Secure` and `Path=/`, forbids
 *   `Domain`, and — the part that matters — a page on a sibling subdomain cannot write it. Without
 *   the prefix, anything that can serve `evil.example.test` can set a cookie that arrives at
 *   `app.example.test` looking exactly like ours.
 * - **`HttpOnly`**, so script cannot read it. In a BFF the browser is not supposed to hold the
 *   credential at all; this is the enforcement of that sentence.
 * - **`SameSite=Lax`**, not `Strict`. `Strict` withholds the cookie on the top-level navigation
 *   *back* from the identity provider, so the callback arrives without the transaction it needs
 *   and every sign-in fails. `Lax` sends it on exactly that navigation and on nothing else risky.
 * - **JWE, not a signature.** The payload is a refresh token: signing would authenticate it and
 *   leave it readable to anyone who can see the cookie. `dir` + `A256GCM` is authenticated
 *   encryption, so a tampered byte fails to decrypt rather than decrypting to something else.
 */

/**
 * The 4 KB a browser is required to keep, and the reason this module has a size guard.
 *
 * A cookie over the limit is not rejected loudly — it is *dropped*, and the symptom is a sign-in
 * that appears to work and a session that is never there. A `SessionStore` is the way out, and the
 * error says so.
 */
const COOKIE_LIMIT = 4096;

export interface SealedCookieConfig {
  /**
   * The name **after** the `__Host-` prefix, which this module adds. A caller cannot decline it:
   * the prefix is the only cookie attribute a browser enforces on our behalf.
   */
  readonly name: string;
  /**
   * The sealing secret. Any length — it is hashed to the 256-bit key — but it is a *secret*, not a
   * password: generate it, do not choose it.
   */
  readonly secret: string | Uint8Array;
  /** Seconds. It is both the cookie's `Max-Age` and the JWE's `exp`, so neither can outlive the other. */
  readonly maxAge: number;
}

export interface SealedCookie<T> {
  /** The full cookie name, prefix included. */
  readonly name: string;
  /** The value of a `Set-Cookie` header carrying `value`. */
  seal(value: T): Promise<string>;
  /** Read from a request's `Cookie` header. `null` for absent, tampered, or expired — all one answer. */
  read(header: string | null | undefined): Promise<T | null>;
  /** The value of a `Set-Cookie` header that removes it. */
  clear(): string;
}

/** One cookie value out of a request's `Cookie` header, or `undefined`. */
export function cookieValue(
  header: string | null | undefined,
  name: string,
): string | undefined {
  if (header === null || header === undefined || header.length === 0) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

async function keyFrom(secret: string | Uint8Array): Promise<Uint8Array> {
  const input = typeof secret === "string" ? new TextEncoder().encode(secret) : secret;
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input as BufferSource));
}

function setCookie(name: string, value: string, maxAge: number): string {
  // No `Domain`: `__Host-` forbids it, and forbidding it is the point — a cookie without a domain
  // is the one a sibling host cannot reach.
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function sealedCookie<T>(config: SealedCookieConfig): SealedCookie<T> {
  const name = `__Host-${config.name}`;
  // Derived once, lazily: the digest is cheap but a request path should not pay for it per call.
  let key: Promise<Uint8Array> | undefined;
  const material = () => (key ??= keyFrom(config.secret));

  return {
    name,

    async seal(value) {
      // The payload is wrapped rather than spread, so a field named `exp` or `iss` in a `Session`
      // could never come to mean the JWT claim of the same name.
      const token = await new EncryptJWT({ v: value })
        .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
        .setIssuedAt()
        .setExpirationTime(`${config.maxAge}s`)
        .encrypt(await material());

      const header = setCookie(name, token, config.maxAge);
      if (header.length > COOKIE_LIMIT) {
        throw new Error(
          `${name} is ${header.length} bytes and a browser is only required to keep ${COOKIE_LIMIT}; ` +
            "a cookie over the limit is dropped silently and the session simply never appears. " +
            "Give relyingParty `store: ticketStore(adapter)` so the cookie carries an opaque " +
            "ticket instead of the tokens: a record holding an access token does not fit here.",
        );
      }
      return header;
    },

    async read(header) {
      const token = cookieValue(header, name);
      if (token === undefined) return null;
      try {
        const { payload } = await jwtDecrypt(token, await material());
        return (payload["v"] ?? null) as T | null;
      } catch {
        // Forged, re-keyed, truncated by a proxy, or simply expired. None of them is a session,
        // and none of them is worth a different answer to the caller — `bff-auth` reads the same
        // endpoint the same way. A thrown error here would only ever be caught and turned into
        // this.
        return null;
      }
    },

    clear() {
      return setCookie(name, "", 0);
    },
  };
}
