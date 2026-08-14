# Kanzo UI — conventions

How to write a file. `DESIGN.md` says what the system is and where a thing belongs; `decisions/`
says why a rule holds and what would reverse it. Nothing here is restated there.

## The three concerns

1. **Behaviour (headless)** — [Ark UI](https://ark-ui.com). State, WAI-ARIA, keyboard, focus.
   Compound parts, `X.RootProvider` + `useX` for controlled state, the `ark.*` polymorphic factory
   with `asChild`. Composites with their own state use our own React context. **No appearance here.**
2. **Appearance** — tokens (`@kanzo-tech/theme/tokens.css`) plus `tailwind-variants` recipes over
   token-backed Tailwind v4 utilities, compiled to `@kanzo-tech/ui/styles.css`. **Nothing themeable
   is decided inside a `.tsx` beyond picking recipe variants.**
3. **API** — a semantic vocabulary (`variant` / `size` / state / composition) that survives upstream
   refactors. `variant`, matching Shark and consumer expectation.

## The reference, and what overrules it

Ark for behaviour, Shark UI for appearance and surface — and the export list is surface, because a
name is the first thing a consumer meets. Two rules of this document once pointed opposite ways over
that, on identical evidence, and neither yielded. So the order is written down: **the reference
governs the surface; a measurement governs the reference; nothing else governs either.** What it
cost to learn: `decisions/a-measurement-overrules-the-reference.md`.

- **A measurement is what a required comment is** — the first of the four under *Comments*: a
  number, what it was measured against, and a threshold it crosses. The diluted focus ring measured
  1.29:1 against the 3:1 WCAG 1.4.11 asks of a component state; without the clause it is a fact
  about a colour, not a reason. A failing test counts when what it asserts is a measurement or an
  external standard, and does not when it asserts a house preference — that is the preference
  wearing a test's clothes. The test is: *would the divergence still be right if whoever wanted it
  left?*
- **The measurement licenses exactly the divergence it measures**, and no neighbouring one. White
  on the status fills, measured at 2.13–3.81:1 against AA's 4.5, bought
  `text-destructive-content` and its three siblings. It bought nothing else in those recipes.
- **A house principle loses to the reference**, however good it is and however correctly it was
  applied. `decisions/an-export-needs-a-second-call-site.md` is right everywhere
  `decisions/a-name-shark-ships-is-ours.md` does not overrule it, and it was overruled while being
  correct.
- **A reference that is wrong is still the reference**, and the first move is the fix that is not a
  divergence — a prop we already own, an upstream report. `Steps` keeps Zag's `role="tab"` with no
  key handling anywhere in Zag and Shark wrapping it unchanged, because stripping the role leaves
  `aria-selected` on a non-widget role, and stripping all of it means hand-rolling the ARIA that
  the accessibility clauses under *Structure and props* forbid. Upstream changes that, or our own
  `linear` prop. Discomfort does not.
- **Silence returns the question to the house rules; it does not open it.** Shark ships no
  `pin-input` at all, so parity neither grants nor refuses `usePinInput`, and admission rule 2
  decides it like anything else of ours.

**Where this does not decide, the owner does** — the two references disagreeing, a name that matches
while its binding does not, a product question in accessibility's clothes. Record the case as
undecided rather than arguing it into a branch. A tie-break claiming more than it settles is the
same defect as a guard claiming more than it proves.

## The recipe

`packages/ui/src/simples/button.tsx` is the reference implementation. Read it rather than a summary:
a `tv()` recipe with semantic `variants` and `defaultVariants`, props extending
`React.ComponentProps<typeof ark.button>` and `VariantProps<typeof …>`, and a plain function
component that spreads the rest onto an `ark.*` element. Nobody has ever broken this shape, which is
why it is a pointer and not a listing.

**React 19, not 18.** The peer is `>=19`, where `ref` is an ordinary prop. Use
`React.ComponentProps<…>`, never `ComponentPropsWithoutRef` (it silently drops `ref`), and never
`forwardRef` — it still works and it is redundant.

**`tailwind-variants` is imported directly**, not through a local shim. A `lib/tv.ts` re-export
existed, was bypassed by most of its callers, and was deleted. If a shared `twMergeConfig` is ever
needed, that is the moment to reintroduce one seam — with a lint rule to enforce it.

## Appearance

- **Themeable vs structural.** The invariant is **re-themeability**, not class-name purity.
  - **Themeable** — anything a token or a theme axis could change: colour, radius, typography,
    spacing scale, borders, shadows, animation. This **must** live in a `tv()` recipe, *including
    when it is conditional*. A ternary assembling `border-e border-border` in the function body is
    the same violation as an inline `style`; it just wears a different hat.
  - **Structural** — pure box model no theme touches: `flex`, `min-w-0`, `shrink-0`, `absolute
    inset-0`, `overflow-hidden`. Inline is fine. A variant-less `tv()` is a string with extra steps.
  - The test: *if a consumer re-skinned the library through tokens, would they expect this to
    change?* Yes → recipe. No → inline.
- **Never** inline `style={}` for variant appearance. A one-off **computed** structural style (a
  width derived from drag state) is fine; a hard-coded constant is not — `minWidth: 200` belongs in
  `min-w-[200px]`, where a class can still override it.
- **Only token-backed utilities.** The semantic families
  (`background`/`foreground`/`card`/`popover`/`primary`/`secondary`/`muted`/`accent`/`destructive`/
  `border`/`input`/`field`/`ring`, plus `info`/`success`/`warning`, `sidebar-*` and `chart-*`), the
  `--radius`-driven `rounded-*` scale, and the Kanzo extras (`--kanzo-font-size-*`,
  `--kanzo-syntax-*`). No raw hex, no raw palette (`bg-slate-700`). Enforced by
  `packages/ui/src/no-literal-hues.test.ts`, which bans **chromatic** literals only — an achromatic
  one belongs to nobody's palette.
- **A percentage is not an alpha step, and `alpha-steps.test.ts` bans seven spellings.** An opacity
  dilutes a solid *toward transparent* and lands wherever the thing underneath puts it; and it lands
  on a different step in each mode, because the dark ramp is deliberately fatter at the bottom. An
  alpha step is solved to composite onto its own solid. The seven, with what replaces each:

  | Banned | Use |
  |---|---|
  | `bg-input/NN` | solid `bg-input` — `--input` is boundary contrast, and diluting it made it a surface |
  | `ring-ring/NN`, `ring-sidebar-ring/NN` | solid `ring-ring` |
  | `bg-field/NN` and every other `*-field/NN` | solid `bg-field` |
  | `bg-destructive/NN`, and `warning`/`success`/`info`, under 50 % | `--X-wash`, `--X-wash-strong` |
  | `border-destructive/NN`, and its three siblings | `--X-border` |
  | `bg-accent/NN` | `--secondary-wash`, `--accent-wash` |
  | `text-muted-foreground/NN` | `--faint` |

  `--muted` is deliberately *not* banned: its remaining dilutions are surfaces, and banning a
  spelling before its replacement exists only moves the problem into a `className` override.
- **`border-input` outlines, `bg-field` fills.** They were one token, and WCAG 1.4.11 applies to
  only one of them: the outline is the visual boundary that identifies a control; a switch track or
  a progress trough is not. The split is by the contrast a site **owes**, not by the CSS property it
  uses — so solid `bg-input` is legal where the site owes boundary contrast.
- **Focus rings are solid**: `outline-none focus-visible:ring-[3px] focus-visible:ring-ring`, plus a
  `focus-visible:border-*` per variant. Shark writes a diluted ring; ours diverges on a measurement,
  which is the only bar that clears the reference at all.
- **One sanctioned exception to the token rule: a colour that is data** — a chart series, a palette
  slot, a colour the user picked. `Swatch` / `SwatchGroup` where it is depicted, `ColorPicker` where
  it is chosen, and a raw `style` in both, because no token can name a value unknown until runtime.
  There used to be a second, `text-white` on a status fill; `text-destructive-content` and its three
  siblings now exist. Worth remembering as a lesson: while that exception stood, the white it
  sanctioned was failing AA on **every** status fill — the 2.13–3.81:1 range measured above — and
  nothing caught it, because **an untokenised colour is a colour no test can measure. An exception
  to this rule is where a defect goes to hide.**
- **A pressable target owes its floor in PIXELS, not in `rem`.** WCAG 2.5.8 states 24×24 in CSS
  pixels; every size here is a `rem` against a root the density axis sets — 16px default, **14px
  compact**, 18px comfortable. So `min-h-6` is 24px at default and **21px at compact**: the failure
  dressed as the fix. Write `min-h-[24px]`. It is the one size in a recipe that must not scale,
  because the bar it answers to does not. `documented-tokens`' sibling `pressable-floor.test.ts`
  reads the recipes and fails on a `rem` floor under 24px; what it cannot see is a target with no
  floor at all, and a hand-rolled row is exactly that — which is how the defect that prompted this
  was written. Two sizes were deleted rather than floored (`Button`'s `xs`, `InputGroupButton`'s
  `xs`): a variant whose *name* promises a size it cannot deliver at one density is not a variant
  worth keeping while nothing is published.
- **`-foreground` means two different things.** For neutral and brand families it is the ink on the
  fill. For the status families it is a readable-on-**background** variant of the same hue — Shark's
  convention, adopted verbatim. Do not "fix" it; it was renamed once and fully reverted.
  `tokens.css` documents both.

## Structure and props

- **`ark.*` on every part that renders a DOM element** — simples, composites *and* layouts, with no
  exemption. `<ark.div>` renders a `div` and forwards everything, so it costs nothing at runtime;
  what it adds is `asChild`, universally. Type props as `React.ComponentProps<typeof ark.div>`,
  never `ComponentProps<"div">`. A component that promises `asChild` in a doc comment without
  `ark.*` is promising something it does not have.
- **`data-slot` on every targetable part**, spelled `<component>-<part>`. It is not decoration: our
  own recipes depend on it — `in-[[data-slot=popover-content]:has([data-slot=popover-body])]:pb-3` —
  and it is the escape hatch consumers get instead of guessing class names.
  - **The primitive owns its slot: write `data-slot={slot ?? "<component>-<part>"}` *after*
    `{...rest}`, never before.** Before the spread, a caller's `data-slot` wins and the primitive's
    own disappears, taking every recipe that selects it with no error and no visible symptom. A slot
    our stylesheet depends on is not a default a caller may override by accident.
  - **`slot?: string` is the sanctioned way to re-slot a part**, and the only one. Destructure it
    out of props and pass it as the `??` left-hand side. **Never declare a type for it, and never
    add a `SlotProps` interface** — React's `HTMLAttributes` already carries `slot`, so every
    `React.ComponentProps<typeof ark.*>` has it and there is nothing to add. The exception is a
    props type extending an Ark *machine's* props rather than HTML attributes, which has no `slot`
    to inherit; `SidebarProps` is the one, and it already had to declare `className` for the same
    reason. A thin rename — `AlertDialogBody` is
    `DialogBody` under a different slot, and the alert-dialog recipes select the renamed values — is
    a real and common need, so it gets a declared prop rather than the accident of spread order.
    Renaming is explicit; erasing is impossible; and a guard test can tell the two apart, which it
    could not while both were spelled `data-slot`.
  - **Never write a bare `data-slot` on one of our components** — only on the DOM element itself.
    TypeScript will not stop you: it does not typecheck a hyphenated JSX attribute, so `data-slot`
    is accepted on any component and silently does nothing on the ten Ark roots that render no
    element at all. Asking for `slot` instead is what surfaced those ten in one `tsc` run.
  - **Under `asChild`, the child wins.** Ark's merge hands the parent's attributes to the child, and
    the child now writes its own slot after its own spread — so a parent can no longer name an
    element it does not render. Push the slot down to the child: `<Button slot="combobox-trigger">`,
    not a `data-slot` on the trigger that wraps it.
- **A layout tree is children, never an attribute.** If a prop's value is markup, it is children. A
  record or array of `ReactNode`s is a layout tree written as an attribute: the caller cannot
  reorder the regions, wrap one, spread `className` / `data-*` / `aria-*` / a handler onto one, or
  use `asChild` on one. `CardHeader`, not `<Card header={…} />`.
  - **The line is what the value *is*, not whether it is an array.** A collection a machine
    navigates is data and belongs in a prop — Ark's `createListCollection` cannot be built from
    children, so `FacetFilter`'s `items`, `Tour`'s `steps` and a faceted column's values are
    correct. Numbers, ids and strings are data. **`ReactNode` in the field type is the tell**, and a
    `separatorBefore: boolean` is the confession: a separator between children, in a shape that has
    no children to put one between.
  - When you want the ergonomics of a list, take a **render prop**:
    `packages/ui/src/simples/FieldArray.tsx`'s `children: (index) => ReactNode` keeps composition and
    still owns the loop.
  - A convenience that flattens a compound into an array is rung 1 of the ladder wearing rung 5's
    clothes. It goes in `docs/examples/`, where it is a demonstration rather than an API.
- **Accessibility, two clauses**, because "accessibility comes from Ark" is not true of this
  codebase: Ark ships no sidebar, app shell, field array or facet filter, and our chart, table and
  editor layers are ours.
  - **Where Ark ships an equivalent, use it.** Never hand-roll focus, keyboard or ARIA it already
    provides. Check `@ark-ui/react/dist/components/` — resolvable from `packages/ui`, not from the
    repository root — before writing a state machine.
  - **Where Ark has none**, the bespoke part documents its ARIA contract in a comment and is covered
    by a test, and **never declares a composite role** (`toolbar`, `listbox`, `tree`, `grid`,
    `tablist`) without implementing that role's keyboard contract. A `role="toolbar"` whose items are
    each independently tabbable, with no roving focus, is worse than no role at all: it promises
    assistive tech a navigation model that is not there.

## Naming

- **Files: kebab-case**, matching Shark. A few older files are PascalCase — drift, not a semantic
  marker. Never rely on case-insensitive resolution: CI is case-sensitive even though macOS is not,
  so a case-mismatched import is a failure you cannot reproduce locally. No such pair exists today
  and none can be added by accident — `tsconfig.base.json` sets `forceConsistentCasingInFileNames`,
  and two paths differing only by case cannot both be checked out here in the first place.
- **Exports: flat, never dot-notation.** Ark publishes namespaced parts; we flatten them the way
  Shark does, so the barrel stays flat and a part is greppable by its full name.
  - **Wrapping an Ark machine → the bare name.** `Accordion`, `Field`, `Pagination`, `Table`,
    `InputGroup`. Parts are base plus part: `AccordionItem`, `FieldLabel`.
  - **Our own compound → `*Root`.** `ShellRoot`, `SectionRoot`, `CompleteRoot`, `ChartRoot` — the
    bare name would name a *concept* rather than an element.
  - A dot-notation namespace is allowed only beside the flat names, and the reason to avoid it is
    stronger than two dialects: **an `Object.assign` namespace does not survive the RSC client
    boundary.** `Preferences` learned that the hard way and re-exported its statics flat.

## Client boundary

Consumed by RSC hosts, so this is load-bearing, not hygiene.

- **A file gets `"use client"` iff *it itself* is stateful** — it calls a hook (any `useX`, ours as
  much as React's), calls `createContext`, registers a listener, **writes an inline JSX event
  handler**, or touches a browser global outside an effect. **Importing a stateful module is not a
  reason.**
  - **A handler prop is the one with no hook in it, and it is the one that catches people out.**
    `onClick={…}` on a part is a *function* passed to a Client Component, and React refuses to
    serialise a function across the boundary. A module with no hook anywhere can therefore still
    need the directive, `tsc` cannot see it, and the failure surfaces layers away in whatever page
    prerenders it. The boundary is established once, by
  the module the hook is in, and every importer above it stays server-renderable and renders it as a
  boundary. Ark depends on this: it ships the directive across its own dist, which is the only
  reason a hook-free wrapper of an Ark machine can be a Server Component at all.
  - **A missing directive is the dangerous failure.** The module is then a Server Component, and a
    hook inside one throws at render. `SidebarNav` shipped this way.
  - **A surplus directive is the cheap one** — the module opts out of server rendering, and drags
    what it imports into the client bundle, for nothing.
  - If you find yourself wanting the directive because something you import is stateful and lacks
    its own, **fix that module instead**. That is the only form of the transitive case, and the
    first half of the rule makes it impossible.
  - Both halves are enforced by `packages/ui/src/client-boundary.test.ts`. The one case it cannot
    see is a browser global reached at module scope; there are none today, and the rule still bans
    them.
- The build must preserve the directives: `preserveModules` plus
  `rollup-plugin-preserve-directives`. Rollup strips them when it merges modules, and that failure
  is invisible to any Vite-based harness, because Vite ignores `"use client"` entirely. `pnpm smoke`
  and the docs App Router build are what catch it.
- **A module that needs an optional peer never goes in the root barrel.** `/editor`, `/table`,
  `/analytics`. A static import of an optional peer from the root entry breaks `import { Button }`
  for everyone who did not install it.

## Comments

A comment is code that cannot be tested, so it decays silently. Write one only when the code cannot
carry the fact. **Four are required; everything else is absent by default.**

1. **A measurement.** A contrast ratio, a ΔE, a byte count, a timing. Cite the number and what it
   was measured against.
2. **A decision a naive reader would undo.** The reason, not the history. The test: *if this line
   were deleted, would the next reader change the code back?*
3. **An ARIA contract**, on every bespoke part where Ark ships no equivalent. Name the roles, the
   keys, and what is announced.
4. **A constraint invisible in the code** — that Tailwind scans comments, so a retired class cannot
   be quoted; that a hoisted object exists because a hook memoises on identity.

**Do not write** what the code says; a `@param` or `@returns` restating a type (we use prose JSDoc,
with `@default`, `@link` and `@example` as the only tags); an empty banner; commented-out code
(there is none — keep it that way); or any legacy, migration or back-compat note, because nothing is
published and such a comment explains code that should not exist.

**Six rules that keep a required comment true.** This repository's comment problem is not ceremony
— there is no commented-out code, and restating comments are rare — it is duplication and
staleness: one paragraph written out in many places, several copies of which went stale
independently. (Neither figure is quoted here on purpose: a tally with no corpus and no command is
what the second rule below forbids, and this paragraph used to break it four times.)
The volume in `packages/palette` is not that problem: `ramp.ts` and `roles.ts` are mostly
measurements against Radix's scales or against a shipped ratio, and a measurement about generated
output rots when the output is regenerated. That is a reason to date them, not to write fewer.

- **Write one copy — one per package that enforces it, and never two inside one package.** State a
  fact where it is enforced and point at it from everywhere else. Where two packages enforce the
  same thing independently they each get a copy, because the lower one may not be sent into the
  other's internals for its reasoning: `@kanzo-tech/palette` keeps its own statement of the
  `.json`-subpath argument. Two copies inside one file is the version that is never defensible.
- **Date a measurement, and name the set it was taken over** — by a name that exists in the source.
  A ratio read off `tokens.css` is a claim about a build artefact and the next `pnpm check:generated`
  can falsify it, so write *"measured 2026-07"* rather than *"today's border ships"*. And a tally
  whose corpus has no name cannot be re-derived, only deleted: *"measured over 118 seeds"* cost an
  hour to reconstruct and turned out to be the system seeds plus every base16 slot value plus the
  tinted neutrals — a set that had since changed size. A count of call sites rots the same way;
  prefer a test that counts.
- **Prose that is hashed, serialised or rendered is data, not a comment.** Correcting it is a code
  change with a changeset, and it may not be safe at all — see
  `decisions/prose-that-is-hashed-is-data.md`, where a stale tally cannot be fixed because the
  string is inside a digest that claims the rules changed. Before editing any string, check whether
  something downstream reads it.
- **Fix the code, not the prose — unless the wrong value is pinned.** A comment describing a wrong
  fixture is usually a wrong fixture. Try the code fix first. When assertions depend on the wrong
  value, correct the comment *and say in it that the value is pinned and why*, or the next reader
  makes the same attempt and reverts it.
- **Cite a symbol, never a line.** A line reference moves silently; several in this repository did.
- **Attach the comment to the thing.** A `/** */` followed by a blank line documents nothing, and no
  editor will show it.

Keep a "used to be X" only when it names the mistake it prevents, and say which mistake. A record of
a closed decision belongs in `decisions/`, not beside the code.

## Testing

`pnpm test` runs vitest across the three packages; `packages/ui` sets `environment: "jsdom"`, and
theme and palette run under node. The minimum bar for a component is a test that renders it and
asserts the behaviour its recipe depends on. Two conventions beyond that:

- **A test is a specification.** `describe("the control fill is an alpha step, not an opacity")`,
  `it("keeps @kanzo-tech/palette out of dependencies")`. Name the claim, not the function.
- **A deleted component gets a tombstone assertion** in `packages/ui/src/index.test.ts`, with the
  reason it went. That is what stops it being rebuilt.

**The repo-wide guard tests.** Each carries its own reasoning, and this table is a routing aid, not
a substitute for it — the right-hand column names the subject so you know which file to open, and
every one of them enforces more, and less, than a row can say. **Read the file.**

| Guard | Enforces |
|---|---|
| `packages/ui/src/index.test.ts` | the enumerated public surface, the tombstones, optional-peer isolation — an enumeration, not an exhaustive pin; `shark-parity.test.ts` is what catches a silent deletion |
| `packages/ui/src/alpha-steps.test.ts` | the seven banned token spellings above |
| `packages/ui/src/no-literal-hues.test.ts` | no chromatic literal in the source |
| `packages/ui/src/logical-properties.test.ts` | no physical direction utility in the three layers, outside a reviewed allowlist with a reason per entry |
| `packages/ui/src/client-boundary.test.ts` | `"use client"` on every stateful module and on no other |
| `packages/ui/src/data-slot.test.tsx` | `data-slot` after the spread, never bare on one of our components, never on a provider-only root |
| `packages/ui/src/documented-exports.test.ts` | no docs page claims a symbol the built surface does not export |
| `packages/ui/src/shark-parity.test.ts` | every difference from Shark's registry is declared, with a reason |
| `packages/ui/src/decisions.test.ts` | every decision record is well-formed, and `DESIGN.md`'s index agrees with it |
| `packages/ui/src/theme/theme-script.test.ts` | the inline script and the provider reach the same `<html>` from the same inputs |
| `packages/theme/src/index.test.ts` | the axis table, its defaults, and what the entry may not re-export |
| `packages/theme/src/boundary.test.ts` | the palette stays a devDependency, and `CHART_SLOTS` answers to the sheet |
| `packages/theme/src/palettes.test.ts` | the sheet is the committed document compiled, with no colour written above the marker |

**Three things a guard test owes.**

- **Say what it cannot prove.** `pnpm smoke` compares the bytes of a built artefact, so it catches
  Rollup dropping a `"use client"` directive and cannot tell you the boundary is in the right
  *place*; only the docs RSC build evaluates that. A guard that states its own blind spot is one
  nobody over-trusts.
- **Mutation-test it.** Write the violation, watch the assertion fail with the message you meant,
  then remove it. A guard nobody has seen fail is a guard nobody has tested. The leak check in
  `pnpm smoke` guarded two symbols that had never existed in this repository, so it could not fail
  and did not, for months.
- **Parse, do not grep, and never let the corpus shrink silently.** `charts/chart-inputs.tsx`
  contained a raw NUL byte, which made `file(1)` and every `grep -I` treat the largest file in the
  chart layer as binary — a grep-based guard would have skipped it and reported a pass. The scan now
  asserts no source file contains one. The general rule: a guard that can silently *not see* part of
  its corpus is worse than no guard, because it reports the same green as a real pass.

**Logical properties, never physical** — `border-e` / `border-s`, `side="start" | "end"`. One code
path mirrors correctly under RTL. The test is the rule; if you need an exception, add it to that
file's allowlist with the reason it does not depend on reading direction.

**When a mistake recurs, write the test, not the paragraph.** See
`decisions/a-rule-broken-three-times-becomes-a-test.md`.

## Distribution

- `@kanzo-tech/palette` — the derivation: ramps, the categorical search, the role table, `compile`.
  **Authoring-time only**, and structurally so: see `decisions/palette-is-authoring-time.md`.
- `@kanzo-tech/theme` — `tokens.css`, `themes.css`, the axis table (`AXES`, `DEFAULT_PREFS`) and the
  value types. **No React, no components, no colour maths.**
- `@kanzo-tech/ui` — the components, `styles.css` (compiled, cascade-layered), and the three
  optional-peer subpaths. The theming runtime lives here: `KanzoThemeProvider`, `useKanzoTheme`,
  `themeScript`, `cookieStorageAdapter`, `Preferences`. Consumers import `styles.css` once.
- Semver via changesets. **A changeset says what a consumer must do differently**, and its bump
  matches the commit subject's own claim: a `!` in the subject is a `major`. The reason a decision
  was taken goes in `decisions/`, not in the changeset.
