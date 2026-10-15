import type { Organization, Session } from "./types";

/**
 * The one runtime reader of a {@link Session}: React-free and engine-free, so the browser and the
 * server answer to the same shape.
 *
 * A session used to be validated twice by hand, `claims()` on the server and this on the browser's
 * side of the wire, and a field added to one and not the other was a silent default (`expiresAt`
 * is `0`). `claims()` now builds its candidate and ends here, `bffAuth` reads the session route's
 * body here, and `session.test.ts` builds a session with `claims()`, serialises it as the route
 * does and reads it back, so a field either side drops fails a test. It is private to the package:
 * a name on a door needs a product's call site (`/docs/design/auth`).
 */

function readOrganization(value: unknown): Organization | null {
  if (typeof value !== "object" || value === null) return null;
  const org = value as Record<string, unknown>;
  const alias = org["alias"];
  if (typeof alias !== "string" || alias.length === 0) return null;
  const strings = (key: string) =>
    Array.isArray(org[key]) ? (org[key] as unknown[]).filter((v): v is string => typeof v === "string") : [];
  return {
    alias,
    id: typeof org["id"] === "string" ? org["id"] : undefined,
    roles: strings("roles"),
    groups: strings("groups"),
    groupsOverage: org["groupsOverage"] === true,
  };
}

/**
 * The session endpoint's answer, checked rather than cast.
 *
 * It is our own server on the other end, and it is still **data off the wire**: a cast here would
 * make a deploy skew or a proxy's error page arrive as a `Session` whose `user` is undefined, and
 * the failure would surface three components away as a property read on nothing. `null` for
 * anything unrecognisable; `bffAuth` reads a 200 it cannot read as `session/unavailable`, because
 * the endpoint answers "nobody is signed in" with a 401 and never with a body.
 */
export function readSession(value: unknown): Session | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;

  const user = body["user"];
  if (typeof user !== "object" || user === null) return null;
  const id = (user as Record<string, unknown>)["id"];
  if (typeof id !== "string" || id.length === 0) return null;

  const person = user as Record<string, unknown>;
  const str = (key: string) =>
    typeof person[key] === "string" && person[key] !== "" ? (person[key] as string) : undefined;

  return {
    user: { id, email: str("email"), name: str("name"), username: str("username") },
    roles: Array.isArray(body["roles"])
      ? body["roles"].filter((r): r is string => typeof r === "string")
      : [],
    organizations: Array.isArray(body["organizations"])
      ? body["organizations"]
          .map(readOrganization)
          .filter((o): o is Organization => o !== null)
      : [],
    organization:
      typeof body["organization"] === "string" && body["organization"] !== ""
        ? body["organization"]
        : undefined,
    expiresAt: typeof body["expiresAt"] === "number" ? body["expiresAt"] : 0,
  };
}
