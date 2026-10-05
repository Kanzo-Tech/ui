// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import * as door from "./next";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));

const SRC = dirname(fileURLToPath(import.meta.url));

function source(module: string): string {
  return readFileSync(resolve(SRC, `${module}.ts`), "utf8");
}

/**
 * Every relative specifier a module imports, extension-less as this repo writes them.
 *
 * All three spellings — `import x from`, a bare `import "./x"`, and a dynamic `import("./x")` —
 * because the sibling guard in `server.test.ts` only knew the first, and a side-effect import
 * walked straight past it. Non-relative specifiers are deliberately not returned.
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
  /**
   * One name. The five factories this replaced each built their own relying party, so there were
   * five discovery caches and five configs to keep in step; the types ride along with the one
   * value and are not counted here because they are not runtime names.
   */
  it("is kanzoAuth and nothing else", () => {
    expect(Object.keys(door)).toEqual(["kanzoAuth"]);
  });

  /**
   * `requireRole` is deliberately absent, and this is the assertion that keeps it absent.
   *
   * A server component asks about a role with `can(session, "owner")` from the root barrel — the
   * same predicate `Gate` asks with in the browser, so there is one evaluation of a role in the
   * package and not two. What `requireRole` would have added is the *throw*, and the throw is the
   * part that is not ours: `forbidden()`, a redirect and a rendered explanation are three different
   * products' answers to one situation, and a library that picks one has picked wrong for the
   * other two.
   */
  it("does not offer requireRole", () => {
    expect(Object.keys(door)).not.toContain("requireRole");
  });

  /**
   * The rule that cost `@kanzo-tech/ui` a package: a server door must not reach React's client
   * half. `./index` re-exports a provider and three hooks, so importing it from here would put
   * them in a Node process. This walk over source is the only check left for it.
   */
  it("reaches no client module", () => {
    const modules = [...reachable("next")];

    expect(modules).toEqual(expect.arrayContaining(["next-auth", "next-gate", "next-routes", "next-proxy"]));
    expect(modules).not.toContain("index");
    for (const module of modules) {
      expect(source(module)).not.toContain('"use client"');
    }
  });

  /**
   * A route handler is handed a standard `Request`, so the routes, the forwarder and the config
   * they share need no framework. Stated as an assertion because it is the thing that would
   * quietly stop being true the first time someone reached for `NextRequest` to read a cookie.
   * The proxy needs `next/server` for `NextResponse.next`, and the server component's session
   * needs `next/headers` and `next/navigation`; those two modules are where the framework lives.
   */
  it("keeps the framework in the two modules that cannot do without it", () => {
    for (const module of ["next-routes", "next-proxy", "next-bound"]) {
      expect(source(module)).not.toContain('"next/');
    }
    expect(source("next-gate")).toContain('from "next/server"');
    expect(source("next-auth")).toContain('from "next/headers"');
    expect(source("next-auth")).toContain('from "next/navigation"');
  });
});
