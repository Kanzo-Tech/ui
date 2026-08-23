# docs/ — rules local to this app

The repository rules are in `../CLAUDE.md`. These five are true only here.

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
