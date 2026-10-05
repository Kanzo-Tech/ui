import { tenantRequest, type Bound } from "./next-bound";
import { outage } from "./next-routes";
import { isSameSite } from "./same-site";
import type { Ended, Token } from "./server";
import { AuthError } from "./types";

/**
 * The BFF half of the *token-mediating backend*: the browser's request goes out again carrying a
 * bearer token, and the cookie that got it here stops at this line. `kanzoAuth().api`.
 *
 * ```ts
 * // lib/auth.ts: kanzoAuth(() => ({ …, api: { mount: "/api/data", target: "https://reports.internal/v1" } }))
 * // app/api/data/[...path]/route.ts
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = auth.api;
 * ```
 *
 * ## Why this is in the package and not in the product
 *
 * Because it is the same ninety lines every time, and one of them is load-bearing in a way that
 * does not look it. **The `cookie` header must not be forwarded.** Leave it on and the resource
 * server receives a second credential — the session cookie — alongside the bearer token it asked
 * for, which is precisely the confusion the BFF pattern exists to remove: from then on a bug at
 * the far end can act as the person rather than as the token, and the token's scope and lifetime
 * stop being the boundary. Every other line here — the hop-by-hop headers, `duplex: "half"`,
 * `redirect: "manual"`, not buffering the body — is the sort of thing that is either right or
 * produces a symptom three layers away, and none of it is a product's idea of its own domain.
 *
 * ## What it answers without asking upstream
 *
 * - **401** when there is no session, or when the renewal was refused — with the cookie cleared in
 *   the same answer. There is nothing to forward: a request with no credential is not the resource
 *   server's to refuse. `bffAuth` answers that 401 by asking `refresh`, and signs in when that is
 *   refused too.
 * - **403** when the request is not same-site. `same-site.ts` carries why the package owes this.
 * - **404** when `kanzoAuth` was given no `api`.
 *
 * ## Renewal happens here too
 *
 * The proxy renews before a page renders, and a client that stays on one page for longer than an
 * access token lives renews here: within a minute of expiry, in place, single-flight per ticket
 * with every other renewal of that session in the process.
 */

/**
 * The upstream is reached with the global `fetch`, and **not** with the inherited `IssuerConfig`
 * one, which is a distinction worth a sentence because it is one field away from being invisible.
 * That `fetch` exists to reach the *identity provider* — it is the seam `internalOrigin` uses to
 * come at Keycloak from inside a cluster. A deployment that set it and found its resource-server
 * traffic going the same way would have every right to be surprised, so there is one name for one
 * transport and the other one is the platform's.
 */

export interface ApiHandlers {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  PATCH(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
  HEAD(request: Request): Promise<Response>;
  OPTIONS(request: Request): Promise<Response>;
}

/**
 * Headers that describe **this** connection and not the message, per RFC 9110 §7.6.1.
 *
 * Forwarding them is how a proxy promises an upstream a connection it does not have. `te` and
 * `trailer` are here for the same reason the others are, and `upgrade` matters most: a forwarded
 * `Upgrade: websocket` invites an answer this handler has no way to complete.
 */
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

/**
 * What is stripped from the browser's request on the way out, beyond the hop-by-hop set.
 *
 * - `cookie` — the whole point, above.
 * - `authorization` — ours is the only one that may be on this request; a caller's own would
 *   otherwise decide which of the two the upstream reads.
 * - `host` — it names this server, not the upstream's, and `fetch` sets the right one.
 * - `content-length` — the body is re-streamed, and a length that survived a re-encode would be a
 *   lie the transport has to discover.
 * - `accept-encoding` — the client's compression negotiation is with *us*; `fetch` runs its own
 *   with the upstream and hands back a decoded body. Passing this on is how a response comes back
 *   labelled `gzip` and already decompressed, which no browser recovers from.
 */
const NOT_FORWARDED = [...HOP_BY_HOP, "cookie", "authorization", "host", "content-length", "accept-encoding"];

/**
 * What is stripped from the upstream's answer.
 *
 * `set-cookie` is the one worth the sentence: under this pattern the browser's cookie relationship
 * is with the BFF alone, and a resource server that could set a cookie on this origin could set
 * one named like ours. `content-encoding` and `content-length` go because `fetch` already decoded
 * the body, so both now describe a representation that no longer exists.
 */
const NOT_RETURNED = [...HOP_BY_HOP, "set-cookie", "content-encoding", "content-length"];

function copyHeaders(from: Headers, without: readonly string[]): Headers {
  const headers = new Headers(from);
  for (const name of without) headers.delete(name);
  return headers;
}

export function forward(instance: () => Promise<Bound>): ApiHandlers {
  const send = (...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args);

  const refuse = (status: number, cookies: readonly string[] = []) => {
    const headers = new Headers({ "cache-control": "no-store" });
    for (const cookie of cookies) headers.append("set-cookie", cookie);
    return new Response(null, { status, headers });
  };

  const handle = async (request: Request): Promise<Response> => {
    const bound = await instance();
    if (bound.api === undefined) return refuse(404);
    if (!isSameSite(request)) return refuse(403);

    const base = bound.api.mount;
    const target = bound.api.target(await bound.tenant(tenantRequest(request)));
    if (target === undefined) return refuse(404);
    /** `https://api.test` has pathname `/`, and a prefix of `/` would double every separator. */
    const prefix = target.pathname.replace(/\/$/, "");

    const url = new URL(request.url);

    // A path outside the mount is not one this handler was mounted for, and refusing it *is* the
    // traversal check: the URL parser has already resolved every dot segment — `..` and its
    // percent-encoded spellings alike, which is the parser's job and not a thing to re-implement
    // — so a path that tried to climb has already fallen out of the prefix by the time it is read.
    if (!url.pathname.startsWith(base)) return refuse(400);

    // Assigning `pathname` rather than composing a string: a path beginning `//` parsed as a *URL*
    // is protocol-relative and names another host, and `//evil.test/x` is a path a browser will
    // happily send. Set as a component it cannot reach the origin at all.
    const upstream = new URL(target.href);
    upstream.pathname = `${prefix}${url.pathname.slice(base.length)}`;
    upstream.search = url.search;

    let held: Token | Ended;
    try {
      held = await bound.party.token(request.headers.get("cookie"), { renewWithin: bound.renewWithin });
    } catch (error) {
      // A refused renewal is the end of the session and not an upstream failure. An IdP or a store
      // that did not answer is an outage, and anything else is a fault this module has no reading
      // of: hiding either behind a 401 would send a person to sign in again over something that
      // will still be there when they get back.
      if (!(error instanceof AuthError)) throw error;
      return refuse(outage(error.code) ?? 401);
    }
    if (held.ended) return refuse(401, held.cookies);

    const headers = copyHeaders(request.headers, NOT_FORWARDED);
    headers.set("authorization", `Bearer ${held.accessToken}`);

    const body = request.method === "GET" || request.method === "HEAD" ? null : request.body;
    const answer = await send(upstream, {
      method: request.method,
      headers,
      body,
      // The body is a stream and is forwarded as one: an upload is not read into this server's
      // memory on its way past, and a server-sent event stream is not buffered until it ends —
      // which for an SSE endpoint means never. `duplex` is what Node requires to allow it.
      ...(body === null ? {} : { duplex: "half" }),
      // A 302 from the upstream is the upstream's answer and belongs to the caller. Following it
      // here would send the bearer token to whatever host the `Location` names.
      redirect: "manual",
    } as RequestInit);

    const out = copyHeaders(answer.headers, NOT_RETURNED);
    // Ours last, so a renewal is never lost to an upstream that had opinions about cookies.
    for (const cookie of held.cookies) out.append("set-cookie", cookie);

    return new Response(answer.body, { status: answer.status, statusText: answer.statusText, headers: out });
  };

  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
    HEAD: handle,
    OPTIONS: handle,
  };
}
