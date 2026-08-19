# The size limit moves when an adoption crosses it, in the commit that crosses it

- **Status** live — 2026-08-19
- **Decided** A `size-limit` entry that a newly adopted component pushes over is raised in the same
  commit, with the before and after figures written down and the component named. It is never
  raised on a tree that adopted nothing.
- **Because** a Tailwind utility only compiles if it is written out as literal text, so a
  component's appearance is source that cannot be compressed, and the barrel is their sum.
- **Reversed by** the same measurement rising on a tree where no module was added — that is a
  regression the budget exists to catch, and no adoption pays for it. A build step that emitted
  class lists from something Tailwind could scan would reverse it too, by making the strings
  compressible after all.
- **Held by** `packages/ui/package.json`, `size-limit`; `packages/ui/src/simples/image-cropper.tsx`,
  `ImageCropperHandle`

## The figures, and how to re-derive them

`image-cropper` was the adoption that crossed it. Measured on 2026-08-19, by deleting the one
`export * from "./simples/image-cropper.js"` line from `src/index.tsx`, rebuilding and re-running
`pnpm --filter @kanzo-tech/ui size`:

| root barrel (JS), brotlied | |
| --- | --- |
| without the component | 41.94 kB |
| with it | 42.60 kB |
| the limit it crossed | 42.5 kB |

The limit is 43 kB now — the same 1% of headroom the crossed one had over its own measurement, so
the entry stays a tripwire rather than becoming a ceiling nobody meets.

## Why this component costs four times what a component usually costs

`ImageCropperHandle` carries eight compass positions, each with its own cursor, its own two border
sides and its own hover, written as sixteen literal class strings because that is the only form
Tailwind's scanner reads. A template literal or a lookup keyed on `position` would compress to
nothing in the bundle and emit no CSS at all, which is a defect that renders as an unstyled handle
rather than as a build error. `packages/ui/src/no-literal-hues.test.ts` takes the same precaution in
its own prose for the same reason, and says so.

## What this does not license

It says nothing about the *other* three entries. The analytics subpath's 68 kB was rebaselined in
`eb63d16` for a different reason — the theme context leaving the provider — and this record does not
generalise to it: that one moved for a change in what the module *does*, and this one moves for a
module that did not exist. It also does not excuse a component from `adoption-before-design.md` or
from `an-export-needs-a-second-call-site.md`. A component with no renderer costs the same bytes and
buys nothing; the budget is not the gate, those are.
