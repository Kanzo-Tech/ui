# The skip target is the `<main>` landmark, not a wrapper inside it

- **Status** live — 2026-07-31
- **Decided** In a shell, `SkipNavContent` is handed to `ShellMain` through `asChild`, so the
  `<main>` itself carries the id and the `tabIndex`. `SkipNavContent` renders its own `<div>` only
  where there is no shell. `ShellMain` takes no skip-target opinion of its own and gains no prop
  for one.
- **Because** the element a skip link lands on should be the landmark the reader asked for, and a
  wrapper nested inside `<main>` is both a second element and a new flex child of the region's own
  scrolling column.
- **Reversed by** a page that must skip to something which is not its `<main>` while still having
  one — a mail client landing on the message list rather than on the whole reading pane is the
  shape to watch for. Also by Ark's `asChild` ceasing to merge attributes down onto a component
  child, which is what makes the composition a composition rather than a copy.
- **Held by** `packages/ui/src/simples/skip-nav.test.tsx`, "puts the id and the focus on the
  <main> itself, not on a div inside it" and "still renders exactly one <main>, and it is still
  ShellMain's slot"; `packages/ui/src/simples/skip-nav.tsx`, `SkipNavContent`

**Why this needed recording at all.** Shark UI's `SkipNavContent` is a `<div>` with a `tabIndex`
and an `outline-none`, because Shark has no layout layer and nothing else can be the target. Read
without that context ours looks like two attributes wearing a component's clothes, and the honest
reading of `decisions/an-export-needs-a-second-call-site.md` is that it should go — a consumer can
write `id` and `tabIndex` on `ShellMain` themselves. What that deletion loses is the shared
constant: the link's `href` fragment and the target's id stop being the same default and become two
strings in two files, and nothing fails when they drift apart. That is the reason to keep it, and
it is not visible from the component.

**The alternative that was rejected.** Giving `ShellMain` the id and `tabIndex={-1}` by default
makes every page in the library a skip target whether or not it ships a link, and puts an
accessibility affordance in a component whose stated job is to place things and declare a landmark
— `decisions/a-region-carries-no-aesthetic.md` is the same argument one axis along. Nesting
`SkipNavContent` inside `ShellMain` was rejected for what it does to the region: `ShellMain` is
`flex min-w-0 flex-1 flex-col overflow-auto`, so the wrapper becomes the flex child and every
consumer has to re-declare the column on it.

**What this closes.** `decisions/exactly-one-main.md` is justified in four places by "skip to main
content", and until now nothing in the library implemented one. The rule and the thing it exists
for now meet: `docs/content/docs/layout/skip-nav.mdx` is linked from `shell.mdx`, and the ambiguity
the one-`<main>` rule prevents is finally an ambiguity in something that ships.
