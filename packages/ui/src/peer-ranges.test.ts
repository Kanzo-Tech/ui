import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SHIPPED } from "./guard-corpus";

/**
 * Every peer range a shipped package declares is bounded above by a major it is built and tested
 * against.
 *
 * Twenty ranges were open-ended — `react >=19`, `lucide-react >=1`, every CodeMirror `>=6`, `next
 * >=16` — across five packages, while `graph` beside them wrote `react ^19.0.0`. An open range is a
 * promise about releases nobody has seen: React 20 or lucide 2 would install clean against every one
 * of these packages, and the first anyone heard of the break would be a host's runtime. A capped range
 * turns the same event into an install-time peer warning, and adopting the new major into a commit
 * that raises the range and the devDependency together.
 *
 * ## The two rules, and how "tested" is read
 *
 * - **Every alternative is a caret** — `^19.0.0`, `^15.3.0 || ^16.0.0`. A caret is the one spelling
 *   that names a floor and stops at the next major (the next minor under `0.x`). A workspace sibling
 *   is `workspace:*`, which pnpm rewrites to the exact version at pack time; the packages release in
 *   lockstep, so an exact sibling is the truth. `ui` once wrote `workspace:^` for the same sibling,
 *   and two spellings of one relationship is the shape this repository collapses.
 * - **The newest alternative is the line the package's own devDependency installs.** That is what
 *   "tested" means here: the build, the typecheck and the tests in this package run against the
 *   devDependency, so the cap can be no higher than its major. A peer with no devDependency is one
 *   nothing here ever installed, and it fails too.
 *
 * ## What this cannot prove
 *
 * - **It cannot see whether the floor is honest.** `^1.0.0` on `lucide-react` says every 1.x works;
 *   nothing installs 1.0 to check, and an icon added in 1.20 would break that host silently. Floors
 *   moved only where a release is load-bearing and says so in the package's `//peers` note — mosaic's
 *   `^0.32.0`, navigation's `^15.3.0`.
 * - **It cannot see an older alternative.** navigation's `^15.3.0` is a declared floor, not a tested
 *   line: the devDependency is 16, and only the newest alternative is held to it.
 */

type Manifest = {
  name: string;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const SIBLING = "workspace:*";
const CARET = /^\^(\d+)(?:\.(\d+))?(?:\.\d+)?$/;

/** The release line a caret admits: the major, or `0.minor` under `0.x`. */
function line(caret: string): string | undefined {
  const match = CARET.exec(caret.trim());
  if (!match) return undefined;
  const [, major, minor = "0"] = match;
  return major === "0" ? `0.${minor}` : major;
}

/** The line a devDependency installs — written as a caret or as a bare version. */
function installed(spec: string): string | undefined {
  return line(spec.startsWith("^") ? spec : `^${spec}`);
}

const MANIFESTS = SHIPPED.map((root) => ({
  label: root.name,
  pkg: JSON.parse(readFileSync(join(dirname(root.src), "package.json"), "utf8")) as Manifest,
}));

describe("peer ranges", () => {
  it("reads a manifest for every shipped package", () => {
    expect(MANIFESTS.map((m) => m.label)).toEqual(expect.arrayContaining(["ui", "graph", "auth"]));
  });

  it("bounds every peer range above by carets, and every sibling to the release it ships with", () => {
    const open = MANIFESTS.flatMap(({ label, pkg }) =>
      Object.entries(pkg.peerDependencies ?? {})
        .filter(([name, range]) =>
          name.startsWith("@kanzo-tech/")
            ? range !== SIBLING
            : range.split("||").some((alternative) => line(alternative) === undefined),
        )
        .map(([name, range]) => `${label}: ${name} ${range}`),
    );
    expect(open).toEqual([]);
  });

  it("caps every peer at the line its own devDependency installs", () => {
    const untested = MANIFESTS.flatMap(({ label, pkg }) =>
      Object.entries(pkg.peerDependencies ?? {})
        .filter(([name]) => !name.startsWith("@kanzo-tech/"))
        .flatMap(([name, range]) => {
          const newest = range.split("||").map(line).at(-1);
          const dev = pkg.devDependencies?.[name];
          if (dev === undefined) return [`${label}: ${name} has no devDependency`];
          return installed(dev) === newest ? [] : [`${label}: ${name} ${range} against ${dev}`];
        }),
    );
    expect(untested).toEqual([]);
  });
});
