/**
 * `@kanzo-tech/auth/server` — the person, read on the server from what the platform's edge forwards.
 *
 * The relying party is not here. oauth2-proxy, in front of the application, signs the person in,
 * keeps the session and renews it (`services/auth`, `/docs/design/auth`); what is left for a server
 * is to verify the access token it forwards and read Keycloak's claims into a {@link Session}. The
 * verification is `jose`'s, which is this door's one engine.
 *
 * Framework-agnostic on purpose: `Headers` in, a `Session` out. `./next` is a thin wrapper over it,
 * and so is anything else.
 *
 * **This door must not reach React.** Its modules import each other directly and never `./index`;
 * `server.test.ts` walks them.
 */

export { claims, type ClaimsConfig } from "./claims";
export { sessionReader, type SessionReaderConfig } from "./forwarded";
