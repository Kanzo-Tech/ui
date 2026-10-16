// GENERATED from problems.bnf by scripts/gen-problems.mjs — do not edit; `pnpm check:generated` fails on a diff.

/** A problem's `type` is this followed by its code (RFC 9457 §3.1.1); derived, never written. */
export const TYPE_BASE = "tag:kanzo.tech,2026:problem/";

export interface ProblemDataMap {
  "engine/unavailable": { readonly after?: number };
  "engine/lost": { readonly reason?: string };
  "engine/failed": { readonly statement?: string };
  "engine/cannot-cancel": Record<string, never>;
  "graph/no-webgl": { readonly after?: number };
  "graph/context-lost": Record<string, never>;
  "graph/no-positions": Record<string, never>;
  "graph/nothing-to-draw": Record<string, never>;
  "graph/too-large": { readonly count: number; readonly limit: number };
  "llm/unavailable": { readonly reason: string };
  "llm/truncated": { readonly reason?: string };
  "llm/silent": { readonly after: number; readonly stage?: string };
  "relations/invalid": { readonly type?: string; readonly edge?: string };
  "relations/unmatched": { readonly term?: string };
  "relations/no-step": { readonly step?: string };
  "session/absent": Record<string, never>;
  "idp/unreachable": { readonly status?: number };
  "idp/silent": { readonly after: number };
  "token/refused": { readonly status?: number };
  "organization/denied": Record<string, never>;
  "claims/no-subject": Record<string, never>;
  "api/unreachable": { readonly status?: number };
  "api/silent": { readonly after: number };
}

/** Per code: the HTTP status where it crosses a wire, the title of the TYPE, the `data` fields and their types. */
export const PROBLEMS: Readonly<Record<keyof ProblemDataMap, { readonly status?: number; readonly title: string; readonly data: Readonly<Record<string, "number" | "string">> }>> = {
  "engine/unavailable": { title: "The engine would not start", data: { after: "number" } },
  "engine/lost": { title: "The engine was lost", data: { reason: "string" } },
  "engine/failed": { title: "The engine refused a statement", data: { statement: "string" } },
  "engine/cannot-cancel": { title: "The engine cannot stop a statement", data: {  } },
  "graph/no-webgl": { title: "The graph cannot be drawn here", data: { after: "number" } },
  "graph/context-lost": { title: "The drawing surface was taken back", data: {  } },
  "graph/no-positions": { title: "The graph has no positions", data: {  } },
  "graph/nothing-to-draw": { title: "The graph is empty", data: {  } },
  "graph/too-large": { title: "The graph is too large to draw", data: { count: "number", limit: "number" } },
  "llm/unavailable": { title: "The model cannot run here", data: { reason: "string" } },
  "llm/truncated": { title: "The answer was cut off", data: { reason: "string" } },
  "llm/silent": { title: "The model made no progress", data: { after: "number", stage: "string" } },
  "relations/invalid": { title: "The relations contradict themselves", data: { type: "string", edge: "string" } },
  "relations/unmatched": { title: "A term names nothing in the catalog", data: { term: "string" } },
  "relations/no-step": { title: "A path step resolves to nothing", data: { step: "string" } },
  "session/absent": { status: 401, title: "Nobody is signed in", data: {  } },
  "idp/unreachable": { status: 502, title: "The identity provider is unreachable", data: { status: "number" } },
  "idp/silent": { status: 504, title: "The identity provider did not answer", data: { after: "number" } },
  "token/refused": { status: 401, title: "The token was refused", data: { status: "number" } },
  "organization/denied": { status: 403, title: "The organization is not permitted", data: {  } },
  "claims/no-subject": { status: 502, title: "The claims name nobody", data: {  } },
  "api/unreachable": { status: 502, title: "The API is unreachable", data: { status: "number" } },
  "api/silent": { status: 504, title: "The API did not answer", data: { after: "number" } },
};
