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
  which is the bar `decisions/match-the-reference.md` sets for diverging at all.
- **One sanctioned exception to the token rule: a colour that is data** — a chart series, a palette
  slot, a colour the user picked. `Swatch` / `SwatchGroup` where it is depicted, `ColorPicker` where
  it is chosen, and a raw `style` in both, because no token can name a value unknown until runtime.
  There used to be a second, `text-white` on a status fill; `text-destructive-content` and its three
  siblings now exist. Worth remembering as a lesson: while that exception stood, the white it
  sanctioned was failing AA on two fills and nothing caught it, because **an untokenised colour is a
  colour no test can measure. An exception to this rule is where a defect goes to hide.**
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
  - **`slot?: string` is the sanctioned way to re-slot a part**, and the only one. A thin rename —
    `AlertDialogBody` is `DialogBody` under a different slot, and the alert-dialog recipes select
    the renamed values — is a real and common need, so it gets a declared prop rather than the
    accident of spread order. Renaming is explicit; erasing is impossible; and a guard test can tell
    the two apart, which it could not while both were spelled `data-slot`.
  - The consequence, which the ordering now makes impossible: a wrapper cannot erase the slot of a
    component it renders by passing one down. Passing a bare `data-slot` into another component is
    still the wrong shape — say what *this* element is on this element, and re-slot with `slot`.
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

- **Files: kebab-case**, matching Shark. Some older files are PascalCase. Never rely on
  case-insensitive resolution — CI is case-sensitive even though macOS is not, and the repository
  already carries one case-colliding pair.
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
  much as React's), calls `createContext`, registers a listener, or touches a browser global outside
  an effect. **Importing a stateful module is not a reason.** The boundary is established once, by
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

**Four rules that keep a required comment true.** This repository's comment problem is not ceremony
— one restating comment in the whole tree, zero commented-out code — it is duplication and
staleness: one paragraph written out nine times, three copies of which went stale independently.

- **Write one copy.** State a fact where it is enforced, beside the code or the test that would
  fail, and point at it from everywhere else. A fact in two places goes stale in one.
- **Date a measurement of something generated.** A ratio read off `tokens.css` is a claim about a
  build artefact and the next `pnpm check:generated` can falsify it. Write *"measured 2026-07"*, not
  *"today's border ships"*. A count of call sites rots the same way — prefer a test that counts.
- **Cite a symbol, never a line.** A line reference moves silently; several in this repository did.
- **Attach the comment to the thing.** A `/** */` followed by a blank line documents nothing, and no
  editor will show it.

Keep a "used to be X" only when it names the mistake it prevents, and say which mistake. A record of
a closed decision belongs in `decisions/`, not beside the code.

## Testing

`pnpm test` runs vitest under jsdom. The minimum bar for a component is a test that renders it and
asserts the behaviour its recipe depends on. Two conventions beyond that:

- **A test is a specification.** `describe("the control fill is an alpha step, not an opacity")`,
  `it("keeps @kanzo-tech/palette out of dependencies")`. Name the claim, not the function.
- **A deleted component gets a tombstone assertion** in `packages/ui/src/index.test.ts`, with the
  reason it went. That is what stops it being rebuilt.

**The repo-wide guard tests.** Each carries its own reasoning; the document carries the pointer and
never a summary, which is the arrangement that keeps both honest.

| Guard | Enforces |
|---|---|
| `packages/ui/src/index.test.ts` | the pinned public surface, the tombstones, optional-peer isolation |
| `packages/ui/src/alpha-steps.test.ts` | the seven banned token spellings above |
| `packages/ui/src/no-literal-hues.test.ts` | no chromatic literal in the source |
| `packages/ui/src/logical-properties.test.ts` | no physical direction utility in the three layers, outside a reviewed allowlist with a reason per entry |
| `packages/ui/src/client-boundary.test.ts` | `"use client"` on every stateful module and on no other |
| `packages/theme/src/boundary.test.ts` | the palette stays a devDependency, and `CHART_SLOTS` answers to the sheet |

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
