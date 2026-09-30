# docs/ — rules local to this app

The repository rules are in `../CLAUDE.md`. What follows is true only here. (It said "these five"
while listing six; a count in a heading is a fact nobody updates, so there is no count now.)

- **`--webpack`, always.** Both `dev` and `build` pass it. vgplot trips a temporal-dead-zone error
  under Turbopack, so charts do not mount without it. Do not "modernise" the scripts.
- **`@source "../../packages/ui/src/**/*.{ts,tsx}"` in `app/global.css` is load-bearing.** This
  sheet loads *after* the library's, so without it the docs sheet has `.hidden` but not the
  `md:*` utilities that undo it, and the desktop sidebar computes `display: none` at every width.
  The comment above the line has the full cascade argument. Do not remove it.
- **One Mosaic coordinator per page.** `MosaicProvider` registers its coordinator as vgplot's active
  one and that setter is process-wide, so a second coordinator on a page leaves the first set of
  charts empty. Memoise one at module scope and share it —
  `examples/charts/mosaic-boot.tsx` is the pattern. Each provider still gets its own selections, so
  one example's brush never reaches the next.
- **`Show`, not `&&` or a ternary**, for conditional rendering. One caveat, and it is the reason
  this is written down: `Show`'s children are an ordinary eager prop, so a guard that dereferences
  a possibly-absent value must stay `&&`.
- **Page, example, showcase — three different things.**
  - A **page** is `content/docs/<group>/<slug>.mdx`. It teaches one component.
  - An **example** is `examples/<slug>/example-<name>.tsx` with a default export.
    `<ComponentPreview>` imports it for the live element and reads the same file for the source, so
    the code shown cannot drift. It is a demonstration, **not a second call site** — an export whose
    only consumer is one example directory has not met admission rule 2.
  - A **showcase** is a whole arrangement in `showcases/<name>/`, wired into the standalone route at
    `app/view/showcases/[name]/`, and embedded in an iframe. It claims the viewport and owns its
    scrolling, because a shell judged inside a centred box proves nothing. This is where
    specificity is allowed to live: an arrangement does not have to become a component.
- **A tool the documentation *offers* is a route, not a showcase.** `/theme-generator` is the case
  and the distinction is worth the line: a showcase is something the docs exhibit, so an iframe
  costs it nothing; an instrument somebody uses needs a URL they can send, a title, and a place in
  the nav, and an iframe takes all three away. It lives in `app/(home)/theme-generator/`, under the
  site nav, which is where daisyUI keeps the same tool. Its shell is `h-auto flex-1`, never `h-dvh`
  — the nav is above it — and the `(home)` layout's container slot is overridden to a `div` so
  `ShellMain` stays the page's only `<main>`.
- **The published site is a DIFFERENT build, and it is opt-in on purpose.** GitHub Pages runs
  nothing, so `pnpm --filter @kanzo-tech/docs build:static` sets `DOCS_STATIC_EXPORT=1` and
  `NEXT_PUBLIC_BASE_PATH=/ui` and then runs `scripts/materialise-mdx.mjs`. `build` is untouched,
  because `output: "export"` removes `next start` — and `check:previews` drives a running server, so
  turning the export on globally would silently retire the guard that caught seven clipped frames.
  `.github/workflows/deploy-docs.yml` is the only place those two variables are set for real.

  Three things it costs, each answered where it lives rather than switched off:
  - **`basePath` reaches the client through one variable**, read by `next.config.ts` *and* by
    `showcases/workspace/graph-view.tsx`. `Link` and `next/image` prefix themselves; a string
    handed to DuckDB does not, and a bare `/corpus/…` under `/ui` is a 404 with no error anywhere.
  - **Search is a file, not a server** — `staticGET` in `app/api/search/route.ts` and
    `search={{ options: { type: "static" } }}` on `RootProvider`. Both halves or neither: one alone
    is a search box that finds nothing and never errors. The index is 8 MB, 1.5 MB over the wire,
    fetched when a reader opens search.
  - **A `.mdx` source route emits the extension in its PATH.** `/docs/ai` is a page *and* the parent
    of `/docs/ai/use-suggestions`, so a static export asks for one name to be a file and a directory
    and dies on `EISDIR` — after prerendering all 434 pages, so it reads as a late failure of
    something else. `generateStaticParams` appends `.mdx` to the last segment and `GET` strips it
    back off; the index page has its own route for the same reason.

- **The corpora are not in the repository; fossil's writer builds them.** Each is `fossil/1` — a
  `fossil.json` written last, one Parquet per vertex type and per relation — `.gitignore`d as
  compiler output under `public/corpus/` (the workspace archive) and `public/bench/` (the
  benchmark's). `@fossil-lang/executor`, a dev dependency, runs the `.fossil` programs in Node
  through `scripts/write-corpus.mjs`; there is no `fossil` CLI in the loop and no second writer.
  `pnpm --filter @kanzo-tech/docs corpus` writes the archive (1,543 vertices, 4,280 edges, about
  45 kB) — `build:static` runs it first, so Pages serves the corpus it built. The benchmark's are
  `node showcases/graph-bench/corpus/build-corpus.mjs [--sizes …]`, never built on CI; the million
  fails inside the executor (a DataFusion memory-pool panic in the WASM), so 200,000 is the largest
  there is until fossil fixes it.
