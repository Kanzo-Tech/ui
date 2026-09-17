/**
 * `@kanzo-tech/auth` — authentication over Keycloak.
 *
 * ## Why a package, and not `@kanzo-tech/ui`
 *
 * The [first admission rule](/docs/philosophy#admission) is *domain-free — nothing about RDF /
 * SHACL / fossil / graphs / **auth***. Auth is excluded by name, deliberately: `ui` is the generic
 * vocabulary every product shares, and a library that knew about sessions once shipped a hard-coded
 * log-out flow inside a sidebar composite. A sibling package is where this belongs.
 *
 * ## What it is not
 *
 * **There is no sign-in screen.** That is the shape of the package rather than a gap in it: a
 * sign-in screen is a logo, a legal line, a privacy notice and a button, and every product answers
 * those differently. What is genuinely shared sits underneath — reading Keycloak's claims into one
 * session, evaluating a role inside an organization, and keeping a `fetch` authenticated.
 *
 * **There is no protocol in it either.** PKCE, silent renewal, storage and cross-tab coordination
 * are `oidc-client-ts`'s, behind `./browser`; the confidential client is `openid-client`'s, behind
 * `./server`. Writing either by hand is where mistakes become vulnerabilities.
 *
 * ## The one rule to read before using it
 *
 * **What a client knows about its roles is for drawing, never for deciding.** The resource server,
 * validating the access token, is what refuses a request. `can` and `Gate` hide controls; they
 * protect nothing.
 *
 * ## What a name means here
 *
 * Three families, and the shape of the name says which one a thing is. Written down because four
 * of these were added in parallel and drifted into two conventions and one exception:
 *
 * - **`<pattern>Auth`** returns an {@link Auth} — `browserAuth`, `bffAuth`. Both patterns RFC 10017
 *   names, one interface, which is what lets `useSession` and `Gate` be written once.
 * - **`auth<Thing>`** returns an auth-flavoured *thing* — `authFetch` a `fetch`, and on `./next`
 *   `authRoutes`, `authSession`, `authMiddleware`.
 * - **Everything else is named for what it is**: `relyingParty`, `issuer`, `sealedCookie`, `claims`,
 *   `can`. The first of those used to be `serverAuth`, which wore the suffix without returning an
 *   `Auth` — the server half's job is `begin`/`complete`/`read`/`refresh`/`end`, not
 *   `getSession`/`signIn`/`fetch`. A name that promises an interface it does not return is worse
 *   than a long one, and *relying party* is the term the specification already uses for it.
 *
 * *What would reverse it:* a fourth family. Two exist because two patterns exist; a third convention
 * would mean the vocabulary has outgrown the rule rather than that the rule needs an exception.
 *
 * ## This door carries no engine
 *
 * Everything here runs on `react` alone, which is why a SPA installs the package and nothing else.
 * `bffAuth` lives here rather than behind a subpath for the same reason: with the token on the
 * server there is no protocol left in the browser, only a `fetch` to a session endpoint.
 */

export { authFetch, type TokenSource } from "./auth-fetch";
export type { AuthContextValue, AuthStatus } from "./auth-context";
export { AuthProvider } from "./auth-provider";
export { bffAuth, readSession, type BffAuthConfig } from "./bff-auth";
export { can, organizationOf } from "./can";
export { claims, roleFromGroupPath, type ClaimsConfig } from "./claims";
export { Gate } from "./gate";
export { organizationFromHost } from "./host";
export { singleFlight } from "./single-flight";
export {
  AuthError,
  type Auth,
  type AuthErrorCode,
  type AuthUser,
  type Organization,
  type Session,
  type SignInOptions,
} from "./types";
export { useOrganization } from "./use-organization";
export { useSession } from "./use-session";
