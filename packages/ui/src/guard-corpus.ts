import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What "repo-wide" means, in one place, for the six guards that claim it.
 *
 * Every one of them used to open with `const SRC = dirname(fileURLToPath(import.meta.url))` and walk
 * from there — which is `packages/ui/src` and nothing else. That was true enough to be invisible
 * while `ui` was the only package with components in it. `@kanzo-tech/ai` shipped ten modules that
 * no guard had ever read a line of, and one of the appearance guards said so in its own blind-spot
 * section while every reader took `CLAUDE.md`'s "the repo-wide guard tests" at face value.
 *
 * The fix is a corpus, not six copies of a rule. A second `no-literal-hues.test.ts` under `packages/ai`
 * would be the shape this repository collapses on sight, and it would rot the first time somebody
 * edited one copy.
 *
 * ## Which packages are in, and why that is derived rather than listed
 *
 * **A package is scanned when it declares `tailwind-variants` as a dependency.** That is the tell
 * that it writes appearance in this house's idiom — a `tv()` recipe over token-backed utilities —
 * and it is the exact population every one of these six rules is about. Measured 2026-08-20 over the
 * five workspace packages it selects `ui` and `ai` and rejects three, each for a reason that is the
 * right reason and not an accident of the filter:
 *
 * · `@kanzo-tech/palette` is colour *derivation*. Its whole subject is hues written as numbers, so
 *   `no-literal-hues` would report the package as one long violation. Its own guards are
 *   `packages/theme/src/{boundary,palettes}.test.ts` and the checks inside `packages/palette`.
 * · `@kanzo-tech/theme` ships `tokens.css` and an axis table. No JSX, no classes, and the colour in
 *   it is generated — `pnpm check:generated` is what holds it, not a scan of hand-written source.
 * · `@kanzo-tech/graph` renders, but it draws with WebGL: one `className` in the package
 *   (`graph-canvas.tsx`) and no `tv()` anywhere. When it grows a recipe it will declare
 *   `tailwind-variants` and join this corpus with nobody remembering to add it — which is the whole
 *   argument for deriving the list. Until then a scan of it would assert an absence over a corpus
 *   that never had the shape.
 *
 * The alternative — "every publishable package's `src`" — reads better and is wrong: it takes
 * `palette` and `theme` with it, and the first thing it would do is fail on the two packages whose
 * job is the thing being banned.
 *
 * ## What a reported path looks like
 *
 * `ui/simples/button.tsx`, `ai/message.tsx`: the package's **workspace directory name**, then the
 * path under that package's `src/`. A bare `simples/button.tsx` was unambiguous while there was one
 * root and is not now, and `packages/ui/src/simples/button.tsx` is four segments of ceremony on
 * every line of every failure message. {@link label} produces it and {@link resolvePath} inverts it,
 * so a pinned list in a guard is written in the same spelling its failures are.
 *
 * ## What this module cannot prove
 *
 * - **It reads manifests, not imports.** A package that writes Tailwind classes by hand without
 *   `tailwind-variants` is outside every scan and nothing says so. That is `graph` today, measured
 *   above; it is a judgement about one file, and it expires the moment that file grows.
 * - **It reads `src/`, and only `.ts`/`.tsx` under it.** A `styles.css` in either package is passed
 *   over by a filter rather than by a decision — see the note each guard carries about its own.
 * - **It cannot see a package that is not in `packages/`.** The workspace globs are `packages/*` and
 *   `docs`; `docs` is not a library and has never been in scope for these rules.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

export const REPO = resolve(HERE, "../../..");

export interface Root {
  /** The workspace directory name — `ui`, `ai`. The first segment of every path a guard reports. */
  readonly name: string;
  /** Absolute path to that package's `src/`. */
  readonly src: string;
}

/** The tell that a package writes appearance the way this repository does. See the docblock. */
const IDIOM = "tailwind-variants";

const rejected: string[] = [];

/**
 * Every package the scans cover, derived from the workspace rather than hard-coded to two paths.
 *
 * `packages/*` is one of the two globs in `pnpm-workspace.yaml`, read here as a directory listing:
 * the other is `docs`, which is not a library.
 */
export const ROOTS: readonly Root[] = readdirSync(join(REPO, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .flatMap((name): Root[] => {
    const dir = join(REPO, "packages", name);
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) {
      rejected.push(`${name}: no package.json`);
      return [];
    }
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as {
      private?: boolean;
      dependencies?: Record<string, string>;
    };
    if (pkg.private === true) {
      rejected.push(`${name}: private, so nothing it contains is shipped`);
      return [];
    }
    if (!(IDIOM in (pkg.dependencies ?? {}))) {
      rejected.push(`${name}: does not depend on ${IDIOM}, so it writes no recipe`);
      return [];
    }
    const src = join(dir, "src");
    if (!existsSync(src)) {
      rejected.push(`${name}: has no src/`);
      return [];
    }
    return [{ name, src }];
  });

/**
 * A glob that silently matches nothing is worse than the two hard-coded paths it replaced, because
 * it reports the same green. Every assertion downstream of this module is an assertion of absence,
 * so an empty or halved corpus passes all of them — the throw is at import time so that the failure
 * arrives as six broken suites rather than six quiet passes.
 *
 * The floor is two rather than one: `ui` alone is the state this module exists to end, and a
 * manifest edit that drops `tailwind-variants` from `ai` would otherwise put the tree back there
 * without a word. Raise it when a third package joins.
 *
 * `documented-exports.test.ts` takes the same precaution from the other end, with `UNBUILT` and
 * `BUILD_FIRST`: a guard that reads an artefact says so when the artefact is not there.
 */
if (ROOTS.length < 2) {
  throw new Error(
    `The guard corpus resolved to ${ROOTS.length} package(s) — ${ROOTS.map((r) => r.name).join(", ") || "none"}.\n` +
      `Every rule built on it asserts an absence, so a shrunken corpus passes silently.\n` +
      `Rejected:\n  ${rejected.join("\n  ")}`,
  );
}
if (!ROOTS.some((root) => root.name === "ui")) {
  throw new Error("packages/ui is not in the guard corpus — the derivation is broken, not the tree");
}

/** `/Users/…/packages/ai/src/message.tsx` → `ai/message.tsx`. Throws rather than guessing. */
export function label(file: string): string {
  const root = ROOTS.find((r) => file === r.src || file.startsWith(r.src + sep));
  if (!root) throw new Error(`${file} is outside every scanned root — it cannot be reported`);
  return `${root.name}/${relative(root.src, file)}`;
}

/** The inverse, so a pinned list in a guard is spelled the way that guard's failures are. */
export function resolvePath(reported: string): string {
  const [name = "", ...rest] = reported.split("/");
  const root = ROOTS.find((r) => r.name === name);
  if (!root) {
    throw new Error(
      `"${reported}" names package "${name}", which is not in the corpus (${ROOTS.map((r) => r.name).join(", ")}).\n` +
        `A pinned entry that resolves to no root is an assertion about a file nobody is reading.`,
    );
  }
  return join(root.src, ...rest);
}

/**
 * Every source file in the corpus, absolute, ordered by the path a failure would report.
 *
 * Tests are excluded: they quote the very spellings the rules ban, on purpose, and several of them
 * assemble one at runtime to keep it out of Tailwind's scan.
 */
export function sourceFiles(extensions = /\.tsx?$/): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (extensions.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(path);
    }
  };
  for (const root of ROOTS) walk(root.src);
  return out.sort((a, b) => (label(a) < label(b) ? -1 : 1));
}

/**
 * Every subtree a scan has to reach, spelled as a path prefix: `ui/simples/`, `ui/charts/`, `ai/`.
 *
 * This replaces the hand-written `LAYERS` array that four of these guards each kept a copy of. Those
 * arrays could only name what somebody remembered to add, which is the failure mode they existed to
 * prevent — a walk that stops descending reports the same green as a real pass, and so does a walk
 * that never learned about a directory added last week. Derived, a new layer and a new package are
 * both covered without an edit; the assertion is that each entry contributed at least one file, so
 * an empty directory added to the tree fails here rather than passing everywhere.
 *
 * A package with sources at the top of its `src/` contributes its bare name. `ai` is flat and that
 * is not drift — it has ten modules and no layer to sort them into, which is why the layer-shaped
 * rules in `logical-properties.test.ts` stay scoped to the package that has layers.
 */
export function subtrees(): string[] {
  const found: string[] = [];
  for (const root of ROOTS) {
    let loose = false;
    for (const entry of readdirSync(root.src, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      if (entry.isDirectory()) found.push(`${root.name}/${entry.name}/`);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) loose = true;
    }
    if (loose) found.push(`${root.name}/`);
  }
  return found.sort();
}

/**
 * The two assertions every one of these guards was making by hand, in the same words.
 *
 * A NUL byte makes `file(1)` and every `grep -I` treat a source file as binary and skip it in
 * silence; `charts/chart-inputs.tsx` held one, in the largest file of the layer with the most colour
 * in it. `readFileSync(…, "utf8")` reads it regardless, so none of these scans ever had that hole —
 * but the next reader reaches for grep first, and a corpus that lies to grep is worth failing on.
 * An empty file is the other half: a scan over nothing proves nothing.
 */
export function unreadable(files: string[]): { binary: string[]; empty: string[] } {
  return {
    binary: files.filter((f) => readFileSync(f).includes(0)).map(label),
    empty: files.filter((f) => readFileSync(f, "utf8").trim() === "").map(label),
  };
}

// ── Chroma, for the guard that bans a hand-written hue ───────────────────────────────────────────
//
// The maths came here when `@kanzo-tech/palette` was deleted, as the twelve lines a guard actually
// needed from an eight-thousand-line package. It has now earned a second caller — the theme studio
// derives an ink from a fill with it — so it lives in `@kanzo-tech/theme` beside the thing it
// describes, and this file holds only the number that is the *guard's* and no one else's.

/**
 * Where a colour stops being a grey and starts being somebody's palette.
 *
 * `0.1` in OKLab chroma, and it is the number the retired package used — carried over rather than
 * re-picked, because moving it would silently change which literals the guard bites on and that
 * migration was not the place to re-argue it.
 */
export const CHROMA_FLOOR = 0.1;

export { oklch } from "@kanzo-tech/theme";
