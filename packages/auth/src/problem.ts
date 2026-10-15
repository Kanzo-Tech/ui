import type { Problem } from "@kanzo-tech/kernel";

/**
 * Every refusal the forwarder sends as a body, in one shape: the kernel's `Problem` as RFC 9457's
 * `application/problem+json`. The status is the registry's (`problems.bnf`), the only table. Only
 * the `./next` modules import this, and none of them reaches React.
 */
export function problem(error: Problem): Response {
  const status = error.status ?? 500;
  const headers = new Headers({ "content-type": "application/problem+json", "cache-control": "no-store" });
  return new Response(JSON.stringify({ ...error.toJSON(), status }), { status, headers });
}
