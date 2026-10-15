import { Problem } from "@kanzo-tech/kernel";

/**
 * Every refusal the auth layer sends as a body, in one shape: the kernel's `Problem` as RFC 9457's
 * `application/problem+json`. The status is the registry's (`problems.bnf`), the only table: the
 * routes, the forwarder and the proxy all read it from the problem itself. Only the `./next`
 * modules import this, and none of them reaches React.
 */

/**
 * A `Problem` as an answer that no cache may hold. `status` defaults to the problem's own; the
 * back-channel logout route is the one caller that passes its own, because its specification fixes
 * it, and the body then says the same.
 */
export function problem(error: Problem, options: { readonly status?: number; readonly cookies?: readonly string[] } = {}): Response {
  const status = options.status ?? error.status ?? 500;
  const headers = new Headers({ "content-type": "application/problem+json", "cache-control": "no-store" });
  for (const cookie of options.cookies ?? []) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({ ...error.toJSON(), status }), { status, headers });
}

/**
 * A session that is over, as its 401 and the cookies that clear it: `session/absent` when there was
 * none, `token/refused` when the IdP would not renew it. The session route, the refresh route, the
 * forwarder and the proxy all end a session with this answer.
 */
export function ended(code: "session/absent" | "token/refused", cookies: readonly string[] = []): Response {
  const message = code === "token/refused" ? "the identity provider would not renew the session" : "nobody is signed in";
  return problem(new Problem(code, message), { cookies });
}
