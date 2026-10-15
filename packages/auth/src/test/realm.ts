import { SignJWT, exportJWK, generateKeyPair, type JWTPayload } from "jose";

/**
 * A realm the tests own: a signing key, its JWK set, and the tokens it signs — what Keycloak's
 * `/protocol/openid-connect/certs` and its token endpoint are to the server reader. Nothing here is
 * a fake protocol: the reader verifies these with `jose` exactly as it verifies Keycloak's.
 */

export const ISSUER = "https://id.example.test/realms/kanzo";
export const CLIENT_ID = "board";
/** Where the process reaches the keys, which is not where the browser reaches the realm. */
export const JWKS = "http://keycloak:8080/realms/kanzo/protocol/openid-connect/certs";
const KID = "realm-key";

export interface Realm {
  /**
   * An access token as the edge would forward it: issued by {@link ISSUER} to {@link CLIENT_ID},
   * for `u-1`, expiring in five minutes, with `claims` over the top. `by: "stranger"` signs it with
   * a key that is not the realm's, under the realm's key id.
   */
  sign(claims?: JWTPayload, options?: { readonly by?: "realm" | "stranger" }): Promise<string>;
  /**
   * A `fetch` that answers the key set at `at` and hands every other request to `rest` — the
   * resource server, in the forwarder's tests. Install it with `vi.stubGlobal("fetch", …)`.
   */
  fetch(rest?: typeof globalThis.fetch, at?: string): typeof globalThis.fetch;
}

export async function localRealm(): Promise<Realm> {
  const realm = await generateKeyPair("RS256");
  const stranger = await generateKeyPair("RS256");
  const keys = { keys: [{ ...(await exportJWK(realm.publicKey)), kid: KID, alg: "RS256", use: "sig" }] };

  return {
    sign(claims = {}, { by = "realm" } = {}) {
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({ iss: ISSUER, azp: CLIENT_ID, typ: "Bearer", sub: "u-1", iat: now, exp: now + 300, ...claims })
        .setProtectedHeader({ alg: "RS256", kid: KID, typ: "JWT" })
        .sign(by === "realm" ? realm.privateKey : stranger.privateKey);
    },
    fetch(rest, at = JWKS) {
      return async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === at) return Response.json(keys);
        if (rest === undefined) throw new TypeError(`nothing answers ${url}`);
        return rest(input, init);
      };
    },
  };
}
