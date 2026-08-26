import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * A page may not document a symbol the library does not export.
 *
 * This is the defect that recurred more than any other, and nothing in the pipeline could see it:
 * `tsc` never reads MDX, the docs build renders prose without evaluating it, and `pnpm smoke`
 * compares bytes of a tarball. In two days it happened five separate times.
 *
 * - Eleven pages named a `useX` context alias after an export audit deleted it; one of them named
 *   it inside an import block, so the example on the page did not compile.
 * - `data-display/charts.mdx` promised `Fixed`, `from`, `plot` and `coordinator` from
 *   `/analytics` — four names `analytics.ts` had deleted on purpose, with the reasoning written
 *   into the barrel three inches from the deletion.
 * - `layout/scroll-area.mdx` said `ScrollAreaScrollbar` "is exported for the rare case you need to
 *   place one yourself". It was a module-local `const` at the time, and the sentence was deleted
 *   rather than the export added. The export came later, from the other direction entirely —
 *   `decisions/a-house-principle-withholds-no-name.md` — which is the thing to notice: the page was
 *   right about the surface the library should have, and a guard over pages can only ever report
 *   that the two disagree.
 * - `forms/index.mdx` and `forms/field.mdx` carried `FieldSeparator` in anatomy diagrams after it
 *   was deleted.
 * - `navigation/steps.mdx` documented `useSteps` after the same audit removed it.
 *
 * Three of those five were found by a person reading pages by hand. That is the work this replaces.
 *
 * **The source of truth is the built surface, not `src`.** `docs/` resolves `@kanzo-tech/ui` to
 * `dist/`, so a symbol can exist in source and still be unimportable from a page — that is the
 * whole reason a rename typechecks clean while the docs build fails. The export set is read out of
 * the emitted `.d.ts` for the root barrel and every subpath in each package's own `exports` map, by
 * the TypeScript checker rather than by a regex over the file: `dist/index.d.ts` is 90 lines of
 * `export *`, and following those by hand is exactly the kind of not-seeing-part-of-the-corpus a
 * guard may not do.
 *
 * **What this cannot prove**, in the order the gaps matter:
 * - It cannot see a symbol documented by *description* rather than by name. A page that says "the
 *   root re-exports the context hook" without naming it passes.
 * - It cannot see a page that is simply missing. Nothing here maps exports to pages, so a component
 *   with no page at all is invisible — and nothing else guards it either. This is the only test
 *   file in the repository that reads `docs/content/docs` at all, and the taxonomy test on
 *   `/docs/philosophy` is prose about classifying a component as a variant or a composite; it is
 *   not executable and it is not about pages. The blind spot is open, not covered.
 * - It cannot see prose that *uses* a name without claiming it exists. Two of the eleven alias
 *   pages read "`useEditable` reads the …" and "`usePinInput` exposes the machine context" — true
 *   sentences about a deleted export, and neither site below fires on them. Widening to all prose
 *   was measured and rejected; see PROSE below.
 * - It cannot see a name that some declared peer also exports. `Table` is ours *and*
 *   `@tanstack/react-table`'s, so deleting ours would not fail here. The guard for a silent
 *   deletion is `shark-parity.test.ts` — `ships every name Shark ships, or declares why not` and
 *   `puts every adopted module's exports on the public barrel` both go red when a name Shark ships
 *   stops leaving our barrel. `index.test.ts` is an *enumeration*, not a pin: 141 names asserted
 *   present and 63 asserted absent, typed out by hand (counted 2026-07-30), with no `Object.keys`
 *   comparison and no snapshot behind them. It never mentions `Table` in either direction, so
 *   deleting `Table` would leave it green. This one is for drift.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(SRC, "../../..");
const PAGES = join(REPO, "docs/content/docs");

const COMPILER: ts.CompilerOptions = {
  noEmit: true,
  skipLibCheck: true,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.Preserve,
};

/**
 * Every entry point a page may import from, read out of the package manifests rather than listed
 * here. Adding a subpath to `exports` extends this guard's reach for free; that is the point of
 * deriving it — a hand-written list is one that goes stale the day someone adds `/graph`.
 */
type Entry = { spec: string; types: string };

function entryPoints(pkgDir: string): Entry[] {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
    name: string;
    exports?: Record<string, unknown>;
  };
  const found: Entry[] = [];
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    const types = (target as { types?: unknown } | null)?.types;
    if (typeof types !== "string" || !types.endsWith(".d.ts")) continue;
    found.push({ spec: pkg.name + subpath.slice(1), types: join(pkgDir, types) });
  }
  return found;
}

/**
 * `graph` is here for the reason the comment above predicted: `docs/content/docs/(root)/graph.mdx`
 * documents `@kanzo-tech/graph`, and until this line the page could name anything at all. It also
 * brings `@kanzo-tech/graph/duckdb` in for free, which is the subpath the optional peers live on —
 * a page that puts `duckBoundedSource` in an import from the root barrel now fails here.
 */
const ENTRIES = ["ui", "theme", "graph", "ai"].flatMap((name) =>
  entryPoints(join(REPO, "packages", name)),
);

/**
 * **The blocks surface, and why it is an entry point rather than an exception.**
 *
 * `docs/content/docs/blocks/` documents the furniture two showcases share — `PanelRail`,
 * `PaneHeader`, `WorkspaceColumns`, `FindingsBadge` — and those pages exist *to say* those names
 * are not exports. Under the union check every one of them is a miss, and the mechanism reached
 * for first was `DELIBERATE`: four entries, growing by one per block, hand-kept. That is the second
 * list this whole module argues against.
 *
 * They are not undefined names, though. They are exported from a module a reader of those pages
 * can genuinely import — the pages say so, in a fenced `import … from "@/showcases/shared"`. So the
 * question the guard asks is unchanged ("can a reader of this page import this name?") and only the
 * surface it asks against widens, for the pages that document that surface. A blocks page naming a
 * block that does not exist now fails, which `DELIBERATE` would have made impossible.
 *
 * It is source, not `dist/` — the one place here that reads a `.tsx` — because this module is never
 * built. Hence `jsx: Preserve` below; nothing is emitted and no diagnostic is read, so an
 * unresolved `lucide-react` inside it costs nothing.
 */
const BLOCKS_SPEC = "@/showcases/shared";
const BLOCKS_FILE = join(REPO, "docs/showcases/shared/index.tsx");
/** Pages allowed to name a block: the group's own pages and the gallery that introduces them. */
const documentsBlocks = (page: string) =>
  page.startsWith("blocks/") || page === join("(root)", "blocks.mdx");

const UNBUILT = ENTRIES.filter((e) => !existsSync(e.types)).map((e) => e.spec);
const BUILD_FIRST =
  "run `pnpm build` first: this guard reads dist/, the way docs/ does, and there is no dist/ here";

/**
 * The packages whose names a page may legitimately write: `@kanzo-tech/ui`'s own dependencies and
 * peers. Ark is the one that made this necessary — pages now point readers at `useStepsContext` and
 * `useSplitterContext`, which are Ark's and must not fail — but the same argument covers every
 * other declared peer, and resolving them beats an allowlist that someone has to remember to feed.
 * These are precisely the packages a consumer already has installed, so a name they export is a
 * name the page's reader can import.
 */
const uiPkg = JSON.parse(readFileSync(join(REPO, "packages/ui/package.json"), "utf8")) as {
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};
const PEER_SPECS = [
  ...Object.keys(uiPkg.dependencies),
  ...Object.keys(uiPkg.peerDependencies),
].filter((spec) => !spec.startsWith("@kanzo-tech/"));

type Surface = {
  /** Exports of one entry point, keyed by the specifier a page writes in its import. */
  bySpec: Map<string, Set<string>>;
  /** Every name any of our entry points exports. */
  ours: Set<string>;
  /** Every name a declared dependency or peer exports. */
  peers: Set<string>;
  /** Every name `docs/showcases/shared` exports — see {@link BLOCKS_SPEC}. */
  blocks: Set<string>;
  /** The peer specifiers that resolved to types, so a silent drop is visible to the assertions. */
  resolved: string[];
};

let cached: Surface | null = null;

function surface(): Surface {
  if (cached) return cached;

  const peerTypes: { spec: string; file: string }[] = [];
  for (const spec of PEER_SPECS) {
    const file = ts.resolveModuleName(spec, join(REPO, "packages/ui/index.ts"), COMPILER, ts.sys)
      .resolvedModule?.resolvedFileName;
    if (file?.endsWith(".d.ts")) peerTypes.push({ spec, file });
  }

  const files = [...ENTRIES.map((e) => e.types), ...peerTypes.map((p) => p.file), BLOCKS_FILE];
  const program = ts.createProgram(files, COMPILER);
  const checker = program.getTypeChecker();

  const namesIn = (file: string): Set<string> => {
    const source = program.getSourceFile(file);
    const symbol = source && checker.getSymbolAtLocation(source);
    // Not an assertion failure but a broken premise: a module with no symbol contributed nothing,
    // and every name it exports would read as undocumented-elsewhere rather than as a miss.
    if (!symbol) throw new Error(`no module symbol for ${file} — is the build stale?`);
    return new Set(checker.getExportsOfModule(symbol).map((s) => s.getName()));
  };

  const bySpec = new Map(ENTRIES.map((e) => [e.spec, namesIn(e.types)]));
  cached = {
    bySpec,
    ours: new Set([...bySpec.values()].flatMap((set) => [...set])),
    peers: new Set(peerTypes.flatMap((p) => [...namesIn(p.file)])),
    blocks: namesIn(BLOCKS_FILE),
    resolved: peerTypes.map((p) => p.spec),
  };
  return cached;
}

/* ------------------------------------------------------------------ extraction */

/**
 * **Where a page names an API, and nowhere else.**
 *
 * The obvious extraction is every backticked identifier of export shape, minus an allowlist of
 * known-external names. It was rejected after measuring it: MDX prose backticks `useState`,
 * `asChild`, `data-slot`, `ark.div`, CSS classes, token names, prop names and type names, and the
 * naive version reported 43 hits, six of them real. A guard with that ratio is switched off
 * inside a week, and the whole argument for a guard test is that it is trusted.
 *
 * So each site below is a place where a page makes a *structured claim about the API*, and the
 * three together caught 12 of the 14 pages in the two historical commits that fixed this defect:
 *
 * - IMPORT — a named specifier in an `import … from "@kanzo-tech/…"` inside a code fence. The
 *   strongest signal there is, and the only one checked against **that specifier's own** export
 *   set rather than the union: an import block naming `plot` from `/analytics` is wrong even
 *   though `@uwdata/vgplot` exports `plot`, and it is wrong in the specific way that stops the
 *   example compiling. Parsed over the whole fence, not line by line — the alias that broke the
 *   Clipboard example sat on its own line inside a multi-line import block.
 * - ANATOMY — the node names in the `text` fence under `## Anatomy`. One name per line, tree glyphs
 *   stripped and the trailing comment dropped, because the comment is prose ("renders Control >
 *   Trigger + ClearTrigger" is a sentence about Ark, not a claim about us). Lowercase nodes are
 *   skipped by design: the pages already use lowercase for a part you cannot reach — scroll-area's
 *   `viewport` and `scrollbar`, toast's `icon` and `close` — so PascalCase in an anatomy tree *is*
 *   the claim that the part is a component you can name.
 * - PROSE — a paragraph that says a symbol is exported. `ScrollAreaScrollbar` and `useSteps` were
 *   both killed by exactly this sentence shape ("is exported for the rare case…", "re-exports
 *   Ark's…"), and scoping to the paragraph rather than the line matters: the charts page wrapped
 *   one such claim across three lines and the names were on the second and third.
 *
 * Three rejected wider nets, each measured on this corpus:
 * - *All prose, not just export claims.* It gains the two pages listed in the blind spots above
 *   and costs `TextField` twice — `philosophy.mdx` and `input-group.mdx` both name it precisely to
 *   argue it should not exist. Keeping the site narrow makes those pass **by construction**, which
 *   is a better answer than an ignore entry.
 * - *Lowercase identifiers in prose.* Needed to catch `from` / `plot` / `coordinator`; it added 50
 *   false positives in one run, every one of them a prop name (`open`, `value`, `disabled`,
 *   `onValueChange`). Dropped. `Fixed` still catches the charts paragraph, so the defect is seen —
 *   just not every name in it.
 * - *`###` headings under `## API Reference`.* They name a symbol about half the time and a group
 *   the other half — `Marks`, `Interactors`, `Axes`, `Legends`, `Helpers`, `Sections`,
 *   `Containers`, `Notes` on today's tree — and nothing structural tells `Pagination` from
 *   `Legends`. The site would need an allowlist of English plurals, maintained by whoever writes a
 *   heading next. The cost of dropping it: a symbol whose only mention on its page is a heading is
 *   not checked.
 */
type Claim = {
  name: string;
  line: number;
  site: string;
  /** Set for IMPORT only: the specifier the name was imported from. */
  spec?: string;
};

/** Export shape: our names are PascalCase or a `use[A-Z]` hook. An all-caps token is an acronym. */
const EXPORT_SHAPED = (name: string) =>
  /^[A-Za-z][A-Za-z0-9]*$/.test(name) && /[a-z]/.test(name) && /^[A-Z]|^use[A-Z]/.test(name);

/** `[^{}]` spans newlines but not a brace, so a multi-line block matches and two adjacent ones do not merge. */
/** `[^{}]` spans newlines but not a brace, so a multi-line block matches and two adjacent ones do not merge. */
const NAMED_IMPORT =
  /import\s+(?:type\s+)?\{([^{}]*)\}\s*from\s*["'](@kanzo-tech\/[^"']+|@\/showcases\/shared)["']/g;
const CLAIMS_EXPORT = /\b(?:re-)?export(?:s|ed)?\b/i;
const BACKTICKED = /`([^`\n]+)`/g;

const lineOf = (body: string, index: number) => body.slice(0, index).split("\n").length;

function claims(page: string): Claim[] {
  const found: Claim[] = [];
  const lines = page.split("\n");
  const prose: ({ line: number; text: string } | null)[] = [];

  let fence: string | null = null;
  let fenceFirstLine = 0;
  let fenceBody: string[] = [];
  let inAnatomy = false;

  for (const [i, line] of lines.entries()) {
    const delimiter = /^\s*```(\S*)/.exec(line);

    if (delimiter) {
      if (fence === null) {
        fence = delimiter[1] || "text";
        fenceFirstLine = i + 2;
        fenceBody = [];
        continue;
      }
      const body = fenceBody.join("\n");
      for (const match of body.matchAll(NAMED_IMPORT)) {
        const [, specifiers = "", spec = ""] = match;
        const at = fenceFirstLine + lineOf(body, match.index) - 1;
        for (const specifier of specifiers.split(",")) {
          const [alias = ""] = specifier.trim().replace(/^type\s+/, "").split(/\s+as\s+/);
          const name = alias.trim();
          if (name) found.push({ name, line: at, site: `import from ${spec}`, spec });
        }
      }
      if (inAnatomy && fence === "text") {
        fenceBody.forEach((node, offset) => {
          const [head = ""] = node.replace(/^[\s│├└─|`+\\-]*/, "").split(/[\s(←<{.]/);
          if (EXPORT_SHAPED(head) && /^[A-Z]/.test(head))
            found.push({ name: head, line: fenceFirstLine + offset, site: "anatomy" });
        });
      }
      fence = null;
      continue;
    }

    if (fence !== null) {
      fenceBody.push(line);
      continue;
    }

    const heading = /^(#{2,6})\s+(.*)$/.exec(line);
    if (heading) {
      const [, hashes = "", title = ""] = heading;
      if (hashes === "##") inAnatomy = /^Anatomy/i.test(title.trim());
      prose.push(null); // a heading also ends the paragraph before it
      continue;
    }
    prose.push({ line: i + 1, text: line });
  }

  let paragraph: { line: number; text: string }[] = [];
  const endParagraph = () => {
    const first = paragraph[0];
    if (first) {
      const body = paragraph.map((p) => p.text).join("\n");
      if (CLAIMS_EXPORT.test(body)) {
        for (const match of body.matchAll(BACKTICKED)) {
          const name = (match[1] ?? "").trim();
          if (EXPORT_SHAPED(name))
            found.push({
              name,
              line: first.line + lineOf(body, match.index) - 1,
              site: "export claim",
            });
        }
      }
    }
    paragraph = [];
  };
  for (const entry of prose) {
    if (!entry || !entry.text.trim()) endParagraph();
    else paragraph.push(entry);
  }
  endParagraph();

  return found;
}

/* ------------------------------------------------------------------ the corpus */

function mdxPages(dir: string, found: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) mdxPages(path, found);
    else if (name.endsWith(".mdx")) found.push(path);
  }
  return found;
}

const FILES = mdxPages(PAGES);
const PAGE_TEXT = new Map(FILES.map((f) => [relative(PAGES, f), readFileSync(f, "utf8")]));
const CLAIMS = new Map([...PAGE_TEXT].map(([page, text]) => [page, claims(text)] as const));

/* ------------------------------------------------------------------ exceptions */

/**
 * A page naming a symbol **in order to say it does not exist**. Correct prose, permanently.
 *
 * The mechanism is a list with a reason per entry rather than a heuristic on negation or past
 * tense, because "there is no `X`" and "`X` was `Y` with the composition done" and "`X` is
 * exported" are one grammar apart and a guard that guesses between them is a guard that is wrong
 * silently. The site selection already handles most of this class for free: `philosophy.mdx` and
 * `input-group.mdx` both argue about `TextField`, and neither paragraph claims it is exported, so
 * neither needs an entry.
 */
const DELIBERATE: Record<string, string[]> = {
  // "There is one export, deliberately… A `SkeletonText` that owns the line count also owns every
  // line's height" — the paragraph explains why the part was not written. `simples/skeleton.tsx`
  // carries the same argument.
  "overlays/loading.mdx": ["SkeletonText"],
};

/**
 * Real defects this guard found on the tree it was written against, recorded rather than fixed:
 * fixing them is a documentation decision, and a decision does not belong in the commit that
 * builds the instrument. Every entry was a name a page presents as a part you can reach, which was
 * a module-local `const` in our own source — the `ScrollAreaScrollbar` shape exactly.
 *
 * **It is empty, and that is the mechanism working rather than an unused container.** All six —
 * `ClipboardIndicator` in an import block that therefore did not compile, `ComboboxClear`,
 * `ComboboxGroupLabel`, `PopoverClose` and `TourClose` in anatomy trees, and `ToastItem` in a
 * sentence claiming outright that it is exported — resolved in the direction this guard cannot
 * choose between: the pages were right and the barrel was wrong. Shark's registry exports every
 * one of them, and `decisions/a-house-principle-withholds-no-name.md` is why that settles it. The
 * list stays because the next defect of this shape needs somewhere to be written down before
 * anybody decides which side of it to fix.
 *
 * **Delete the entry with the fix.** The last test below fails on an entry that is no longer
 * needed, so this list cannot outlive the defects in it.
 */
const KNOWN_DEFECTS: Record<string, string[]> = {};

const excused = (page: string, name: string) =>
  (DELIBERATE[page]?.includes(name) ?? false) || (KNOWN_DEFECTS[page]?.includes(name) ?? false);

/** Every claim that does not resolve, before the exceptions are applied. Keyed by page. */
function unresolved(): Map<string, Claim[]> {
  const { blocks, bySpec, ours, peers } = surface();
  const misses = new Map<string, Claim[]>();
  for (const [page, found] of CLAIMS) {
    for (const claim of found) {
      // An import names its own package, so check that package: `ClipboardIndicator` is Ark's and
      // importing it from `@kanzo-tech/ui` is wrong however many other packages export the name.
      // Anatomy and prose name no package, so the union is the honest question there — can a
      // reader of this page import this name at all?
      const here = documentsBlocks(page);
      const resolves = claim.spec
        ? claim.spec === BLOCKS_SPEC
          ? blocks.has(claim.name)
          : (bySpec.get(claim.spec)?.has(claim.name) ?? false)
        : ours.has(claim.name) || peers.has(claim.name) || (here && blocks.has(claim.name));
      if (resolves) continue;
      misses.set(page, [...(misses.get(page) ?? []), claim]);
    }
  }
  return misses;
}

/* ------------------------------------------------------------------ assertions */

describe("the documented surface", () => {
  // Resolving eight entry points and twenty peer packages through the checker costs a few seconds,
  // once. It happens here so no single assertion pays it and trips the default test timeout — and
  // it is skipped on an unbuilt tree so the first assertion below gets to say why.
  beforeAll(() => {
    if (UNBUILT.length === 0) surface();
  }, 120_000);

  it("reads a built surface, and says so when there is none", () => {
    // Without this the failure is `no module symbol for …/dist/index.d.ts` from inside the
    // TypeScript checker, three frames deep, on a clean checkout. CLAUDE.md: build first.
    expect(UNBUILT, BUILD_FIRST).toEqual([]);
  });

  it("resolves every entry point and every declared peer", () => {
    expect(UNBUILT, BUILD_FIRST).toEqual([]);
    const { bySpec, ours, peers, resolved } = surface();

    // A subpath that resolves to an empty module would shrink the corpus in silence and turn every
    // one of its names into a pass. Each entry point must contribute, and the canaries prove which.
    for (const [spec, names] of bySpec) expect(names.size, spec).toBeGreaterThan(0);
    for (const [spec, canary] of [
      ["@kanzo-tech/ui", "Button"],
      ["@kanzo-tech/ui/table", "DataTableRoot"],
      ["@kanzo-tech/ui/analytics", "ChartRoot"],
      ["@kanzo-tech/ui/editor", "CodeEditor"],
      ["@kanzo-tech/theme", "AXES"],
      ["@kanzo-tech/graph", "memorySource"],
      ["@kanzo-tech/ai", "SuggestRoot"],
      // On the subpath and not the barrel — the optional-peer door. `index.test.ts` in that package
      // asserts the same split from the runtime side.
      ["@kanzo-tech/graph/duckdb", "duckBoundedSource"],
    ] as const) {
      expect(bySpec.get(spec)?.has(canary), `${spec} should export ${canary}`).toBe(true);
    }

    // 903 at the time of writing. A floor, and nothing in the repository holds the exact surface:
    // `index.test.ts` enumerates names by hand, `shark-parity.test.ts` holds the half of it Shark
    // also ships. A name that is ours alone can leave the barrel without either going red.
    expect(ours.size).toBeGreaterThan(500);
    // Ark is the peer this guard cannot do without: the pages point at its context hooks by name.
    expect(resolved).toContain("@ark-ui/react");
    expect(peers.has("useStepsContext"), "Ark's own exports must resolve").toBe(true);
  });

  it("sees every page, whole", () => {
    // 93 pages and 691 claims when this was written. The floors exist because a glob that matches
    // nothing reports the same green as a clean tree — and because `charts/chart-inputs.tsx` hid
    // the largest file in the chart layer from three `grep`s with one NUL byte. Anything that can
    // silently not see part of its corpus is worse than no guard at all.
    expect(FILES.length).toBeGreaterThan(60);
    expect([...CLAIMS.values()].flat().length).toBeGreaterThan(400);
    for (const [page, text] of PAGE_TEXT) expect(text.includes("\0"), `${page} has a NUL`).toBe(false);
  });

  it("documents no symbol the library does not export", () => {
    expect(UNBUILT, BUILD_FIRST).toEqual([]);
    const offenders: string[] = [];
    for (const [page, found] of unresolved())
      for (const claim of found)
        if (!excused(page, claim.name))
          offenders.push(`${page}:${claim.line}  ${claim.name}  (${claim.site})`);
    // Failing? Either the page is wrong — delete the name, or point it at the Ark export it was
    // renaming — or the export is missing and belongs in the barrel. If the page names it in order
    // to say it does not exist, add it to DELIBERATE with the sentence that makes that true.
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  it("keeps both exception lists alive", () => {
    expect(UNBUILT, BUILD_FIRST).toEqual([]);
    const misses = unresolved();
    const stale: string[] = [];
    for (const [label, list] of [
      ["DELIBERATE", DELIBERATE],
      ["KNOWN_DEFECTS", KNOWN_DEFECTS],
    ] as const) {
      for (const [page, names] of Object.entries(list)) {
        if (!CLAIMS.has(page)) {
          stale.push(`${label}: ${page} no longer exists`);
          continue;
        }
        for (const name of names)
          if (!misses.get(page)?.some((c) => c.name === name))
            stale.push(`${label}: ${page} no longer needs ${name}`);
      }
    }
    // An excuse that is no longer needed is an excuse that hides the next defect behind the same
    // name — either the page stopped saying it, or the export arrived. Delete the entry.
    expect(stale).toEqual([]);
  });
  /**
   * The same two inputs, read the other way: every name we EXPORT is named on some page.
   *
   * The forward question — "is this name real?" — has been asked here since the file was written.
   * This is its reverse, and it catches the defect the forward one cannot see: a symbol on the
   * barrel that no page mentions is a symbol a reader can only find by reading `index.ts`. It is
   * asked of every entry point, so `theme`, `graph` and `ai` are in it too, and it needs no
   * allowlist — an allowlist here would be the second list this whole module argues against.
   *
   * **The site is the flat one, deliberately.** Not the claim sites above: those are
   * PascalCase-or-`use[A-Z]` by construction, which is right for "is this real?" and useless for
   * "is this mentioned?" — `cn`, `sql`, `min` and two hundred others can never be a claim, so the
   * reverse question asked that way reports misses that are the extractor's shape rule and not
   * defects. Measured on this corpus at 280 of them.
   *
   * ## What this cannot prove
   *
   * - **A word is not a mention.** `sum`, `mode`, `column` and `forces` pass on any page using the
   *   English word. That is the honest trade for a question about *absence*: a false pass costs a
   *   missing sentence, and a false failure would cost an allowlist.
   * - **It does not read what the page says.** A name in a fenced import, in a prop table or in a
   *   sentence saying the export is deprecated all read the same. Whether the mention is useful is
   *   what review is for.
   * - **Types and values are one question here.** `getExportsOfModule` returns both, and requiring
   *   a page to name every interface is the stricter of the two readings — chosen deliberately on
   *   2026-08-23, measured at 178 type names against 14 values, and closed rather than excused.
   */
  it("names every export we ship on some page", () => {
    const corpus = [...PAGE_TEXT.values()].join("\n");
    const unnamed: string[] = [];
    for (const [spec, names] of surface().bySpec) {
      for (const name of names) {
        const word = new RegExp(`\\b${name.replace(/[$]/g, "\\$")}\\b`);
        if (!word.test(corpus)) unnamed.push(`${spec}: ${name}`);
      }
    }

    expect(
      unnamed.sort(),
      `An export no page names is one a reader can only find by opening \`index.ts\`. Say it\n` +
        `somewhere — a sentence, a row in a prop table, a line in an anatomy block. There is no\n` +
        `allowlist on purpose:\n${unnamed.join("\n")}`
    ).toEqual([]);
  });
});
