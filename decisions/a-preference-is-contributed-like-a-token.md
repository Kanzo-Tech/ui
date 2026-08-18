# A preference is contributed the way a token is

- **Status** live — 2026-08-18
- **Decided** A package that owns a user-facing choice contributes it as a **preference section** —
  a namespace, declared options, a default — exactly as it already contributes tokens: stored
  opaquely by the core, validated against the manifest its owner ships, preserved when the package
  is absent, and drawn by one renderer on **any** surface. A tenant's document may **pin or
  withhold** a section, which is what makes a white-labelled product one product rather than a fork.
  Resolution is one chain — pinned, stored, the tenant's starting point, the declaration's default —
  and the host registers the manifests, so the core still names no optional package. **The core's own
  axes go through all of it**, under the namespace `theme`.
- **Because** the appearance document already extends by namespace and the preference model does
  not, so every optional package with a user-facing choice has to invent a settings surface beside
  the panel.
- **Reversed by** no second contributor appearing. If the graph's look is the only user choice an
  optional package ever has, this is a mechanism over a single call site and `children` on the panel
  is the whole answer.
- **Held by** `packages/theme/src/sections.test.ts`, "keeps a section whose package is not
  installed"; `packages/theme/src/index.test.ts`, "every axis default matches DEFAULT_PREFS,
  generated or not"; `packages/ui/src/theme/KanzoThemeProvider.tsx`, `PREF_KEYS`;
  `packages/graph/src/look-section.ts`, `LOOK_SECTION`;
  `docs/showcases/workspace/graph-view.tsx`, `GraphAppearance`

## What this record left open, settled 2026-08-18

Three things, and one sentence above was wrong when it was written.

- **The storage layout.** One key, `sections`, keyed by namespace then by preference, values always
  strings. What settled it was the read-time whitelist: riding on a key `DEFAULT_PREFS` already has
  is what lets an unrecognised namespace survive a write by a host that dropped the package.
- **Whether one manifest carries both halves.** It does. Two exports would let a namespace and a
  version drift apart while describing the same section, and the namespace is the whole contract.
- **«Rendered by the one panel» was wrong, and it was the sentence that mattered.** A section draws
  wherever it is mounted — the panel, a settings page, a dock inside a canvas — through
  `PreferencesSections`, and what a surface renders it with is one control per `kind`. A mechanism
  whose only surface was the panel would have failed the first consumer that had a canvas.

And one thing this record did not anticipate at all: the asymmetry it describes was **symmetrical**.
The core's own axes had the older mechanism — a stored blob read through a whitelist — so a tenant
could pin the graph's look and could not pin the radius. They are declared and resolved by this
chain now; see `decisions/the-declaration-ships-with-the-library.md` for what that costs to ship.

## The asymmetry, and where to read it

Both halves of appearance are extended by optional packages. Only one of them has a mechanism.

**Tokens.** `packages/theme/src/sections.ts` — a namespace, declared tokens, defaults expressed as
bindings against the tenant's ramps, resolution by hierarchical fallback, validation against the
owner's manifest. The core never learns a section exists, which is what keeps
`packages/theme/src/boundary.test.ts` passing by text match rather than by discipline.

**Preferences.** `ThemePrefs` is a closed interface and `AXES` a closed table, both in
`packages/theme/src/index.ts`. The panel in `packages/ui/src/composites/Preferences.tsx` renders a
fixed list, and its extension point is `children`, which *replaces* that list rather than adding to
it. So the graph took the only route available: `GraphAppearance` in
`docs/showcases/workspace/graph-view.tsx` holds `look` and `display` in the showcase's own React
context — not persisted, not pre-painted, no reset, invisible to `DEFAULT_PREFS`.

That is the same package contributing to both halves and getting a declarative mechanism for one and
a private copy of the panel for the other.

## The two properties this borrows, and why they are the load-bearing ones

**An absent package must not cost the user their choice.** `PREF_KEYS` is
`Object.keys(DEFAULT_PREFS)` and the read-time whitelist drops every key not in it. That whitelist
is right for what it was built for — it is what stopped retired colour axes re-entering through
storage — and it is exactly wrong for a contributed preference: a host that drops an optional peer
for one release loses the user's stored choice permanently. The token side already solved this by
treating a section's payload as opaque data rather than as a type the core parses, and
`sections.test.ts` pins it.

**A default may be derived rather than copied.** A token section's default is a binding, so a
tenant changing their palette moves `--graph-marquee` with it. The preference side has the same case
one level up and no way to express it: a tenant who wants the graph to open in Ink has nowhere to
say so.

## Declaring is half of it; the other half is one resolution chain

The declaration is a manifest in the owning package. What deploys it is a chain, most specific
first, and the reason to write it down as a chain is that the token half already is one —
`resolveSectionToken` answers *the first member that answers, and says which one it used*, and a
preference that resolved by some other order would be a second mechanism wearing the first one's
vocabulary.

1. The user's stored value, **unless the tenant pinned it**.
2. The tenant document's policy for that section: pinned to a value and no control, withheld
   entirely, or merely started somewhere other than the manifest says.
3. The manifest's own default.

**The host registers, and that is what keeps the door shut.** Manifests reach the provider as a
prop, so the arrow points host → core: nothing here names an optional package, and a host that never
installed one cannot pass its manifest. Registration by import into the core would be the same
mechanism with the dependency inverted, and `packages/theme/src/boundary.test.ts` is what would
fail.

**Application splits on whether the declaration carries an attribute** — see the next section — and
the panel renders one section per registered manifest, only where policy has not withheld it.

## The case that does not fit: a preference that writes nothing to the DOM

`AXES` exists because three things must agree about an attribute — the provider, the pre-hydration
script, and the generator that decides which selectors exist at all. A contributed preference does
not necessarily have an attribute: the graph's look is read by JS and pushed into the renderer's
config, and an editor's font size would want one. So the attribute is a field a declaration *may*
carry, the way `source` already discriminates on the rows of `AXES` rather than forcing every axis
through one path. A preference with no attribute costs the pre-hydration script nothing, which is
the property that keeps the script from growing with every optional package.

## Tenant policy is selection, never authorship

The document may say *this section is fixed to this value* or *this section is not offered*. It may
not say *this section's value is one I invented*: the choices are the ones the owning package
declared, and a tenant picks among them or removes the control. That is the same line the colour
half already holds — a user chooses among colours somebody validated and never authors one — and
stating it here is what stops the policy field becoming the runtime palette authoring that
`a-role-earns-its-name-or-becomes-a-step` and the retired axes exist to prevent.

## What this does not touch

- **The admission rule.** `a-section-brings-measurable-obligations` still decides what may be a
  section at all; this record says how a section's *preferences* reach the panel, not what earns
  one. Simulation coefficients are still not appearance, and a panel that accepted them would be the
  drawer that rule exists to prevent.
- **The four generated axes.** Radius, font, mono font and density are the core's own and stay in
  `AXES`. Nothing here proposes re-expressing them as sections; a mechanism that swallowed its own
  host's table would be generalising in the wrong direction.
- **Colour.** `palette` and `identity` are rows of `AXES` because a document is a stylesheet and the
  attribute selects between compiled blocks. They are not contributed by anyone.
