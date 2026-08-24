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
    `showcases/workspace/graph-state.tsx`. `Link` and `next/image` prefix themselves; a string
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

- **The workspace showcase's corpus is not in the repository**, so the published site has no
  archive to read unless that changes. It is 108 kB under `public/corpus/`, `.gitignore`d as
  compiler output, and regenerating it needs the `fossil` binary, which CI does not have. Locally it
  is there and the showcase draws 1,543 nodes; on Pages it will not be.
