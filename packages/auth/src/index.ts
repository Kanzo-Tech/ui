/**
 * `@kanzo-tech/auth` — the person behind the platform's edge, over Keycloak.
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
 * **There is no sign-in screen, and no relying party.** oauth2-proxy, a platform service in front of
 * the application, signs the person in, keeps the session, renews it and signs out, and forwards the
 * access token (`services/auth`, `/docs/design/auth`). What is shared and left here sits on top of
 * that: reading Keycloak's claims into one session on the server, handing it to the browser, and
 * evaluating a role inside an organization.
 *
 * ## The one rule to read before using it
 *
 * **What a client knows about its roles is for drawing, never for deciding.** The resource server,
 * validating the access token, is what refuses a request. `can` and `Gate` hide controls; they
 * protect nothing.
 *
 * ## This door carries no engine
 *
 * Everything here runs on `react` alone. The session arrives as a prop from the server that read it
 * (`./server`, `./next`), so a browser fetches nothing and installs nothing else.
 */

export { accountUrl, organizationConsoleUrl, type AccountPage } from "./account";
export { AuthProvider } from "./auth-provider";
export { can, organizationOf } from "./can";
export { Gate } from "./gate";
export { type AuthUser, type Organization, type Session } from "./types";
export { useSession } from "./use-session";
