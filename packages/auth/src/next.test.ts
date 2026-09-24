// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as door from "./next";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const SRC = dirname(fileURLToPath(import.meta.url));

function source(module: string): string {
  return readFileSync(resolve(SRC, `${module}.ts`), "utf8");
}

/**
 * Every relative specifier a module imports, extension-less as this repo writes them.
 *
 * All three spellings — `import x from`, a bare `import "./x"`, and a dynamic `import("./x")` —
 * because the sibling guard in `server.test.ts` only knew the first, and a side-effect import
 * walked straight past it. Non-relative specifiers are deliberately not returned: `next-middleware`
 * imports `next/server`, and the assertion below reads this as "nothing from this package".
 */
function importsOf(module: string): string[] {
  const found = new Set<string>();
  for (const match of source(module).matchAll(/(?:\bfrom|\bimport)\s*\(?\s*"(\.[^"]+)"/g)) {
    const specifier = match[1];
    if (specifier !== undefined) found.add(specifier);
  }
  return [...found];
}

/** Everything `./next` pulls in, transitively, by relative import. */
function reachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const module = pending.pop();
    if (module === undefined || seen.has(module)) continue;
    seen.add(module);
    for (const specifier of importsOf(module)) {
      pending.push(relative(SRC, resolve(SRC, dirname(`${module}.ts`), specifier)));
    }
  }
  return seen;
}

describe("@kanzo-tech/auth/next", () => {
  it("is five names and nothing else", () => {
    expect(Object.keys(door).sort()).toEqual([
      "authMiddleware",
      "authProxy",
      "authRoutes",
      "authSession",
      "authToken",
    ]);
  });

  /**
   * `requireRole` is deliberately absent, and this is the assertion that keeps it absent.
   *
   * A server component asks about a role with `can(session, "owner", alias)` from the root barrel
   * — the same predicate `Gate` asks with in the browser, so there is one evaluation of a role in
   * the package and not two. What `requireRole` would have added is the *throw*, and the throw is
   * the part that is not ours: `notFound()`, `redirect("/choose-an-organization")` and a rendered
   * explanation are three different products' answers to one situation, and a library that picks
   * one has picked wrong for the other two.
   */
  it("does not offer requireRole", () => {
    expect(Object.keys(door)).not.toContain("requireRole");
  });

  /**
   * The rule that cost `@kanzo-tech/ui` a package: a server door must not reach React's client
   * half. `./index` re-exports a provider and three hooks, so importing it from here would put
   * them in a Node process — and `scripts/smoke-install.mjs` reads the built bytes for exactly
   * this, on the sibling door, which is a slower way to find out.
   */
  it("reaches no client module", () => {
    const modules = [...reachable("next")];

    expect(modules).not.toContain("index");
    for (const module of modules) {
      expect(source(module)).not.toContain('"use client"');
    }
  });

  /**
   * The middleware runs in the edge runtime, where `openid-client` and `jose` have no business
   * being. It stays clean by importing nothing from this package at all — which is also why the
   * cookie name is written there a second time, and why `next-middleware.test.ts` ties the two.
   */
  it("keeps the middleware free of the package's own engines", () => {
    expect(importsOf("next-middleware")).toEqual([]);
    expect(source("next-middleware")).toContain('from "next/server"');
  });

  /**
   * A route handler is handed a standard `Request`, so the half of this door that does the actual
   * work needs no framework. Stated as an assertion because it is the thing that would quietly
   * stop being true the first time someone reached for `NextRequest` to read a cookie.
   */
  it("serves its routes without importing next", () => {
    expect(source("next-routes")).not.toContain('"next/');
  });

  /**
   * The same rule for the two doors added beside them, and for the same reason: a `Request` in and
   * a `Response` out is the whole of what a route file needs, so reaching for `NextRequest` here
   * would buy nothing and would make both untestable without the framework. `authSession` is the
   * one module that genuinely cannot be written this way — `next/headers` is how a server
   * component reaches a request it was never handed — and it is the only one that imports it.
   */
  it("proxies and mints tokens without importing next either", () => {
    expect(source("next-proxy")).not.toContain('"next/');
    expect(source("next-token")).not.toContain('"next/');
    expect(source("next-session")).toContain('from "next/headers"');
  });
});
