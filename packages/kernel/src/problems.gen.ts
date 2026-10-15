// GENERATED from problems.bnf by scripts/gen-problems.mjs — do not edit; `pnpm check:generated` fails on a diff.

/** A problem's `type` is this followed by its code (RFC 9457 §3.1.1); derived, never written. */
export const TYPE_BASE = "tag:kanzo.tech,2026:problem/";

export interface ProblemDataMap {
  "engine/unavailable": { readonly after?: number };
  "engine/lost": Record<string, never>;
  "engine/failed": Record<string, never>;
  "engine/cannot-cancel": Record<string, never>;
  "graph/no-webgl": { readonly after?: number };
  "graph/context-lost": Record<string, never>;
  "graph/no-positions": Record<string, never>;
  "graph/nothing-to-draw": Record<string, never>;
  "graph/too-large": { readonly count: number; readonly limit: number };
  "llm/unavailable": { readonly reason: string };
  "llm/truncated": { readonly reason?: string };
  "llm/silent": { readonly after: number; readonly stage?: string };
  "relations/invalid": { readonly type?: string };
  "relations/unmatched": { readonly term?: string };
  "relations/no-step": { readonly step?: string };
  "session/absent": Record<string, never>;
  "session/unavailable": { readonly status?: number };
  "session/silent": { readonly after: number };
  "session/irrevocable": Record<string, never>;
  "idp/unreachable": { readonly status?: number };
  "idp/silent": { readonly after: number };
  "token/exchange-failed": { readonly status?: number };
  "token/refused": { readonly status?: number };
  "organization/invalid": Record<string, never>;
  "organization/denied": Record<string, never>;
  "callback/state-mismatch": Record<string, never>;
  "callback/nonce-mismatch": Record<string, never>;
  "claims/no-subject": Record<string, never>;
  "api/unreachable": { readonly status?: number };
  "api/silent": { readonly after: number };
}

/** Per code: the HTTP status where it crosses a wire, the title of the TYPE, the `data` fields and their types. */
export const PROBLEMS: Readonly<Record<keyof ProblemDataMap, { readonly status?: number; readonly title: string; readonly data: Readonly<Record<string, "number" | "string">> }>> = {
  "engine/unavailable": { title: "The engine would not start", data: { after: "number" } },
  "engine/lost": { title: "The engine was lost", data: {  } },
  "engine/failed": { title: "The engine refused a statement", data: {  } },
  "engine/cannot-cancel": { title: "The engine cannot stop a statement", data: {  } },
  "graph/no-webgl": { title: "The graph cannot be drawn here", data: { after: "number" } },
  "graph/context-lost": { title: "The drawing surface was taken back", data: {  } },
  "graph/no-positions": { title: "The graph has no positions", data: {  } },
  "graph/nothing-to-draw": { title: "The graph is empty", data: {  } },
  "graph/too-large": { title: "The graph is too large to draw", data: { count: "number", limit: "number" } },
  "llm/unavailable": { title: "The model cannot run here", data: { reason: "string" } },
  "llm/truncated": { title: "The answer was cut off", data: { reason: "string" } },
  "llm/silent": { title: "The model made no progress", data: { after: "number", stage: "string" } },
  "relations/invalid": { title: "The relations contradict themselves", data: { type: "string" } },
  "relations/unmatched": { title: "A term names nothing in the catalog", data: { term: "string" } },
  "relations/no-step": { title: "A path step resolves to nothing", data: { step: "string" } },
  "session/absent": { status: 401, title: "Nobody is signed in", data: {  } },
  "session/unavailable": { status: 503, title: "The session could not be read", data: { status: "number" } },
  "session/silent": { status: 504, title: "The session did not answer", data: { after: "number" } },
  "session/irrevocable": { status: 501, title: "The session cannot be revoked", data: {  } },
  "idp/unreachable": { status: 502, title: "The identity provider is unreachable", data: { status: "number" } },
  "idp/silent": { status: 504, title: "The identity provider did not answer", data: { after: "number" } },
  "token/exchange-failed": { status: 502, title: "The token exchange failed", data: { status: "number" } },
  "token/refused": { status: 401, title: "The token was refused", data: { status: "number" } },
  "organization/invalid": { status: 400, title: "The organization is not valid", data: {  } },
  "organization/denied": { status: 403, title: "The organization is not permitted", data: {  } },
  "callback/state-mismatch": { status: 400, title: "The callback does not match", data: {  } },
  "callback/nonce-mismatch": { status: 400, title: "The callback does not match", data: {  } },
  "claims/no-subject": { status: 502, title: "The claims name nobody", data: {  } },
  "api/unreachable": { status: 502, title: "The API is unreachable", data: { status: "number" } },
  "api/silent": { status: 504, title: "The API did not answer", data: { after: "number" } },
};
