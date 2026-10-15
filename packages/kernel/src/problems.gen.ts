// GENERATED from problems.bnf by scripts/gen-problems.mjs — do not edit; `pnpm check:generated` fails on a diff.

export interface ProblemDataMap {
  "engine/unavailable": { readonly after: number };
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

export const PROBLEMS: Readonly<Record<keyof ProblemDataMap, { readonly status?: number; readonly title: string }>> = {
  "engine/unavailable": { title: "The engine would not start" },
  "engine/lost": { title: "The engine was lost" },
  "engine/failed": { title: "The engine refused a statement" },
  "engine/cannot-cancel": { title: "The engine cannot stop a statement" },
  "graph/no-webgl": { title: "The graph cannot be drawn here" },
  "graph/context-lost": { title: "The drawing surface was taken back" },
  "graph/no-positions": { title: "The graph has no positions" },
  "graph/nothing-to-draw": { title: "The graph is empty" },
  "graph/too-large": { title: "The graph is too large to draw" },
  "llm/unavailable": { title: "The model cannot run here" },
  "llm/truncated": { title: "The answer was cut off" },
  "llm/silent": { title: "The model made no progress" },
  "relations/invalid": { title: "The relations contradict themselves" },
  "relations/unmatched": { title: "A term names nothing in the catalog" },
  "relations/no-step": { title: "A path step resolves to nothing" },
  "session/absent": { status: 401, title: "Nobody is signed in" },
  "session/unavailable": { status: 503, title: "The session could not be read" },
  "session/silent": { status: 504, title: "The session did not answer" },
  "session/irrevocable": { status: 501, title: "The session cannot be revoked" },
  "idp/unreachable": { status: 502, title: "The identity provider is unreachable" },
  "idp/silent": { status: 504, title: "The identity provider did not answer" },
  "token/exchange-failed": { status: 502, title: "The token exchange failed" },
  "token/refused": { status: 401, title: "The token was refused" },
  "organization/invalid": { status: 400, title: "The organization is not valid" },
  "organization/denied": { status: 403, title: "The organization is not permitted" },
  "callback/state-mismatch": { status: 400, title: "The callback does not match" },
  "callback/nonce-mismatch": { status: 400, title: "The callback does not match" },
  "claims/no-subject": { status: 502, title: "The claims name nobody" },
  "api/unreachable": { status: 502, title: "The API is unreachable" },
  "api/silent": { status: 504, title: "The API did not answer" },
};

export const PHRASES: Readonly<Record<number, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};
