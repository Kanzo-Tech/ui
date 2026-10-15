import { Problem, isProblem, within } from "@kanzo-tech/kernel";
import type { Forwarded } from "./forwarded";
import { tenantRequest, under, type Bound } from "./next-bound";
import { problem } from "./problem";
import { isSameSite } from "./same-site";

/**
 * The forwarder: the browser's request to `/api/…` goes out again to the resource server, carrying
 * the access token the edge forwarded as its bearer, and the cookie that got it here stops at this
 * line. `kanzoAuth().api`.
 *
 * ```ts
 * // lib/auth.ts: kanzoAuth(() => ({ …, apis: { "/api/data": { target: (org) => `https://${org}.reports.internal/v1` } } }))
 * // app/api/[...path]/route.ts — one route file can serve every mount under it
 * export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = auth.api;
 * ```
 *
 * The token is forwarded as it came, with no exchange: the edge asked for the API's scope at
 * sign-in, so `aud` already names it (`/docs/design/auth`, *The session is the platform's edge*).
 * It is verified here before it is forwarded — the same check every server read makes — so a header
 * that did not come through the edge is refused at this line and never reaches an API, which
 * verifies it again itself.
 *
 * ## Why this is in the package and not in the product
 *
 * Because it is the same ninety lines every time, and one of them is load-bearing in a way that
 * does not look it. **The `cookie` header must not be forwarded.** Leave it on and the resource
 * server receives a second credential — the edge's session cookie — alongside the bearer token,
 * and from then on a bug at the far end can act as the person rather than as the token. Every other
 * line here — the hop-by-hop headers, `duplex: "half"`, `redirect: "manual"`, not buffering the
 * body — is the sort of thing that is either right or produces a symptom three layers away.
 *
 * ## What it answers without asking upstream
 *
 * A refusal with a code is an RFC 9457 problem whose `code` is the registry's code, at the status
 * `problems.bnf` gives it:
 *
 * - **401** when the edge forwarded no token (`session/absent`), or one that did not verify
 *   (`token/refused`). There is nothing to forward: a request with no credential is not the
 *   resource server's to refuse.
 * - **403** when the request addresses an organization the token does not name
 *   (`organization/denied`): the person is not a member there, and the API is not asked.
 * - **502** or **504** when the realm's keys could not be fetched to verify the token
 *   (`idp/unreachable`, `idp/silent`).
 * - **504** when the API connected and sent no headers within 25 s (`api/silent`); the client leaving
 *   ends the hop too, and then nothing is answered.
 * - **502** when the API itself did not answer — the connection was refused, its name did not
 *   resolve, it reset before a status line (`api/unreachable`). An API that answers, with any
 *   status, has answered, and that answer is passed through as it came.
 *
 * Three answers carry no code, and so no body, because they are about the request and not about a
 * credential: **403** when it is not same-site — `same-site.ts` carries why the application owes
 * this — **404** when `kanzoAuth` was given no `apis` or the mount's `target` names no server for
 * the organization, and **400** for a path under no mount.
 */

/** Until the upstream's headers, in milliseconds (`/docs/design/failure`, *one deadline per wait*). */
export const FORWARD_WITHIN = 25_000;

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
 * - the edge's `x-forwarded-access-token`, `x-forwarded-user` and `x-forwarded-email` — the token
 *   travels once, as the bearer, and the other two are the edge's unsigned word for what the token
 *   says with the realm's signature.
 * - `authorization` — ours is the only one that may be on this request; a caller's own would
 *   otherwise decide which of the two the upstream reads.
 * - `host` — it names this server, not the upstream's, and `fetch` sets the right one.
 * - `content-length` — the body is re-streamed, and a length that survived a re-encode would be a
 *   lie the transport has to discover.
 * - `accept-encoding` — the client's compression negotiation is with *us*; `fetch` runs its own
 *   with the upstream and hands back a decoded body. Passing this on is how a response comes back
 *   labelled `gzip` and already decompressed, which no browser recovers from.
 * - `origin` and the Fetch Metadata headers — what a browser says about the page that caused *its*
 *   request (RFC 6454 §7, W3C Fetch Metadata), which `isSameSite` has already read. The request to
 *   the upstream is this server's, caused by no page, and an upstream that checks `Origin` — Docker
 *   Model Runner refuses any it does not list with a 403 — would otherwise judge a browser that
 *   never addressed it.
 */
const NOT_FORWARDED = [
  ...HOP_BY_HOP,
  "cookie",
  "x-forwarded-access-token",
  "x-forwarded-user",
  "x-forwarded-email",
  "authorization",
  "host",
  "content-length",
  "accept-encoding",
  "origin",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "sec-fetch-user",
];

/**
 * What is stripped from the upstream's answer.
 *
 * `set-cookie` is the one worth the sentence: the browser's cookie relationship is with the edge and
 * this origin alone, and a resource server that could set a cookie on this origin could set one
 * named like the edge's. `content-encoding` and `content-length` go because `fetch` already decoded
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

  /** A refusal about the request rather than a credential: a status, and nothing to route on. */
  const refuse = (status: number) => new Response(null, { status, headers: { "cache-control": "no-store" } });

  const handle = async (request: Request): Promise<Response> => {
    const bound = await instance();
    if (bound.apis.length === 0) return refuse(404);
    if (!isSameSite(request)) return refuse(403);

    const url = new URL(request.url);

    // A path under no mount is not one this handler was mounted for, and refusing it *is* the
    // traversal check: the URL parser has already resolved every dot segment — `..` and its
    // percent-encoded spellings alike, which is the parser's job and not a thing to re-implement
    // — so a path that tried to climb has already fallen out of every mount by the time it is read.
    const api = bound.apis.find((candidate) => under(url.pathname, [candidate.mount]));
    if (api === undefined) return refuse(400);

    const organization = await bound.tenant(tenantRequest(request));
    const target = api.target(organization);
    if (target === undefined) return refuse(404);
    /** `https://api.test` has pathname `/`, and a prefix of `/` would double every separator. */
    const prefix = target.pathname.replace(/\/$/, "");

    // Assigning `pathname` rather than composing a string: a path beginning `//` parsed as a *URL*
    // is protocol-relative and names another host, and `//evil.test/x` is a path a browser will
    // happily send. Set as a component it cannot reach the origin at all.
    const upstream = new URL(target.href);
    upstream.pathname = `${prefix}${url.pathname.slice(api.mount.length)}`;
    upstream.search = url.search;

    let held: Forwarded | null;
    try {
      held = await bound.read(request.headers);
    } catch (error) {
      // A token that did not verify, or keys that could not be fetched, each with its code. Anything
      // else is a fault this module has no reading of, and is thrown as it came.
      if (!isProblem(error)) throw error;
      return problem(error);
    }
    if (held === null) return problem(new Problem("session/absent", "the edge forwarded no access token"));
    // The address is a hint and the token is the authority: a request in an organization the token
    // does not name is refused here, before the API spends anything on it.
    if (organization !== undefined && !held.session.organizations.some((org) => org.alias === organization)) {
      return problem(new Problem("organization/denied", "the person is not a member of the organization this request addresses"));
    }

    const headers = copyHeaders(request.headers, NOT_FORWARDED);
    headers.set("authorization", `Bearer ${held.token}`);

    const body = request.method === "GET" || request.method === "HEAD" ? null : request.body;
    let answer: Response;
    try {
      // Bounded until the upstream's headers, and no longer: a server-sent event stream or an upload
      // is alive after them and is not ours to end on a clock. The client leaving ends either one.
      answer = await within(
        FORWARD_WITHIN,
        (signal) =>
          send(upstream, {
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
            signal,
          } as RequestInit),
        {
          // The person navigating away cancels the hop, or N tabs against one hung API hold N sockets.
          signal: request.signal,
          silent: (after) => new Problem("api/silent", `the API mounted at ${api.mount} sent no headers within ${after} ms`, { after }),
        },
      );
    } catch (error) {
      if (request.signal.aborted) throw error;
      if (isProblem(error)) return problem(error);
      // `fetch` rejects with a `TypeError` for a network error and for nothing else it can meet
      // here: a refused connection, a name that did not resolve, a reset before the status line.
      // That API did not answer, and it is the forwarder's to name, not a bare 500's. An upstream
      // that answers 500 has answered, and its answer passes through below.
      if (!(error instanceof TypeError)) throw error;
      return problem(new Problem("api/unreachable", `the API mounted at ${api.mount} did not answer`));
    }

    const out = copyHeaders(answer.headers, NOT_RETURNED);

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
