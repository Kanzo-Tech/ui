import type { AuthError, AuthErrorCode } from "./types";

/**
 * Every refusal the auth layer sends as a body, in one shape: an RFC 9457 problem.
 *
 * `status`, `title` and `detail` are the RFC's members, and `code` and `data` are the library's
 * extension members — the `area/kind` code and its data, which is what a host's error registry keys
 * and what keasy's API and fossil's errors already send. There is no `type`, so it is the RFC's
 * `about:blank`, and §4.2.1 then has the title be the status's own phrase: the code is what a host
 * routes on and the detail what a person might read, so the title invents no third wording.
 *
 * Only the `./next` modules import this, and none of them reaches React.
 */

/**
 * The status for each code, and the only table: the routes, the forwarder and the proxy all read
 * it. Two tables once disagreed — one sent `organization/denied` to 400, the other to 403.
 *
 * A party that did not answer is a 5xx named for who: the IdP is upstream (502, 504), the store is
 * this server's own (503, 504). A refusal is a 4xx: no credential is 401, a credential that does
 * not admit this organization is 403, and a request that cannot be read is 400. A token response
 * that names nobody is the realm's fault and not the person's, so it is 502 too.
 */
const STATUS: Record<AuthErrorCode, number> = {
  "claims/no-subject": 502,
  "session/absent": 401,
  "session/unavailable": 503,
  "session/silent": 504,
  "organization/invalid": 400,
  "organization/denied": 403,
  "callback/state-mismatch": 400,
  "callback/nonce-mismatch": 400,
  "token/exchange-failed": 502,
  "token/refused": 401,
  "session/irrevocable": 501,
  "idp/unreachable": 502,
  "idp/silent": 504,
};

/** The HTTP status an `AuthErrorCode` is answered with. */
export function statusOf(code: AuthErrorCode): number {
  return STATUS[code];
}

/** The reason phrases of the statuses above, RFC 9110 §15, as `about:blank` asks for its title. */
const PHRASE: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/**
 * An `AuthError`, or an ended session's code, as an `application/problem+json` answer that no
 * cache may hold. `status` defaults to {@link statusOf}; the back-channel logout route is the one
 * caller that passes its own, because its specification fixes it.
 */
export function problem(
  error: Pick<AuthError, "code" | "message"> & { readonly data?: AuthError["data"] },
  options: { readonly status?: number; readonly cookies?: readonly string[] } = {},
): Response {
  const status = options.status ?? statusOf(error.code);
  const headers = new Headers({ "content-type": "application/problem+json", "cache-control": "no-store" });
  for (const cookie of options.cookies ?? []) headers.append("set-cookie", cookie);
  const body = {
    status,
    title: PHRASE[status] ?? "Error",
    detail: error.message,
    code: error.code,
    ...(error.data !== undefined && Object.keys(error.data).length > 0 ? { data: error.data } : {}),
  };
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * A session that is over, as its 401 and the cookies that clear it: `session/absent` when there was
 * none, `token/refused` when the IdP would not renew it. The session route, the refresh route, the
 * forwarder and the proxy all end a session with this answer.
 */
export function ended(code: "session/absent" | "token/refused", cookies: readonly string[] = []): Response {
  const message = code === "token/refused" ? "the identity provider would not renew the session" : "nobody is signed in";
  return problem({ code, message }, { cookies });
}
