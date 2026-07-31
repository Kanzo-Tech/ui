# Kanzo UI — what the system is

The rules. `CONVENTIONS.md` is how to write a file inside them; `decisions/` is why each holds and
what would reverse it. Nothing is restated across the three.

## The governing constraint

> **This is our library, generic, for anything we want to build.**

Stronger than domain-freedom. Domain-freedom stops RDF and auth from leaking in; it does not stop a
component's *shape* from being dictated by one consumer, which is how a general shell ended up
reading as one product's metadata view.

Two consequences, and the second is what makes the first affordable: the library ships a **generic
vocabulary**, and **specific arrangements are showcases** — `docs/showcases/` — not components. An
arrangement someone actually uses does not have to become a component. It has to become an example.

## The three axes

Name a part's axis before deciding where it belongs.

1. **Structure** — where something sits and what scrolls. **No appearance**: no opinion about
   colour, surface or typography.
2. **Content** — titles, actions, controls, text. Appearance, from tokens and recipes.
3. **Behaviour** — focus, keyboard, ARIA, positioning, collision. **Ark owns this.** Where Ark has
   none we write it, document the ARIA contract, and cover it with a test.

**A part sits on one axis.** A part that declares a position *and* a height, a surface and a font is
two parts.

## The three layers

| Directory | What lives there | Test |
|---|---|---|
| `simples/` | Single-purpose components — Button, Input, Dialog, Select | Does one thing |
| `composites/` | Assemblies of simples — Sidebar, CodeEditor, Preferences | Made of several, still fits in a page |
| `layouts/` | Page and window scaffolding — the Shell and Section regions | Positions other things |

The public barrel is **flat**, so moving between layers never breaks a consumer. That is what makes
a taxonomy mistake cheap to fix, and why it should be fixed rather than lived with.

**The engine rule.** *A component that needs an engine is the presentational one plus the engine —
two components, not one. The presentational half lives in the root barrel; the connected half lives
on the engine's subpath and renders the first.* `Table` → `DataTable` on `/table`; `StatTile` →
`ChartStat` on `/analytics`. A subpath entry statically re-exports its engine, so any import from it
resolves an optional peer; putting the presentational half there would make showing a number from a
REST call require DuckDB. Hence the placement test: **a part belongs on a subpath only if it imports
that subpath's engine.** Thematic neighbourhood is not a reason.

**The naming rule.** *`kebab-case` is the vendored primitive; `PascalCase` is our pre-assembled
convenience built on top of it.* `TextField` imports `input` and `input-group`; `DateField` imports
`date-picker` and `calendar`. They are not competitors — one is built from the other. Default to the
PascalCase one; drop to the primitive when it does not fit.

**The taxonomy test.** *A machine with a switch → a variant or a mode. A new content contract
assembled on a primitive → a PascalCase composite.*

## The layout layer

```
ShellRoot                         full-height column, owns the viewport
├── ShellHeader                   ┐
├── ShellBody                     │ structural only:
│   ├── ShellAside side="start"   │ placement, the separating border,
│   ├── ShellMain                 │ what shrinks and what scrolls
│   └── ShellAside side="end"     │
└── ShellFooter                   ┘
```

**The regions carry no aesthetic and declare no role.** They place their children and separate
themselves from a neighbour; everything visible inside is the caller's, and the call site passes the
landmark. So there is no bar component: a dense strip is *something you put in a region*.

**Exactly one `<main>` per page**, owned by `ShellMain`; nested containers use `<section>`.
`SidebarInset` is a neutral offset `<div>`, not a `<main>` — it is the inset styling wrapper, and
the `ShellMain` inside it owns the landmark. shadcn does the opposite because it has no region
layer; we do. A shell has two legal shapes and they do not mix — see
`decisions/a-shell-has-two-legal-shapes.md`.

**The header rule.** One header vocabulary, `SectionRoot` and its parts. `CardHeader` and
`DialogHeader` do not merge into it: *a header wired to a machine stays with its machine; only
pure-layout headers merge.* That the line is right is shown by `TourHeader` *being* `DialogHeader`.

## Validation

**The library displays errors. Products produce them.** `Field` takes a boolean and a `ReactNode`;
where they came from is the product's business. Full reasoning in `.planning/FORMS-DECISION.md`.

## Admission

A new component enters only if all four hold:

1. **Domain-free.** Nothing about RDF, SHACL, fossil, graphs or auth.
2. **Proven demand.** Two real call sites, not a hypothesis. One `docs/examples/<slug>/` directory
   is not a second call site — it is the page proving the part exists.
3. **Wraps, does not reinvent.** Check `@ark-ui/react/dist/components/` before writing a machine.
4. **Single axis.**

And one rule about *not* building: **do not add a model before the existing parts have a consumer.**

**Two standing exceptions, and both are narrow.** The `/analytics` mark and interactor wrappers are
one-line descriptors over somebody else's grammar, and they stay complete even where no example
draws one: a vocabulary with holes sends the author to `@uwdata` for the one thing we left out,
which is the import the layer exists to remove. The exception is priced on the wrappers being one
line each — `decisions/a-grammar-ships-its-whole-vocabulary.md` — and does not generalise to
components with bodies.

The second is the same shape one library along: the `useX` context aliases and the Ark parts
re-exported beside them ship because Shark UI's registry ships them, under the same names, with no
call site of its own either. The vocabulary a consumer arrives with is the thing being bought —
`decisions/a-name-shark-ships-is-ours.md`, which also says which names Shark does *not* ship and
therefore neither do we.

That second exception is an instance, not a special case. **A reference system outranks a rule of
ours; only a measurement outranks the reference.** The order, what counts as a measurement and the
three places it decides nothing: `decisions/a-measurement-overrules-the-reference.md`, stated as a
rule in `CONVENTIONS.md`.

### Reach for a new component last

Each rung is cheaper than the next, and a new component is reserved for genuinely new **behaviour**
or **DOM structure**, never a new look.

1. **A prop or variant** — a different appearance of the same machine is a `tv()` variant, not a file.
2. **Composition and `data-*`** — every state is mirrored, so a caller restyles with CSS alone.
3. **`asChild` or a render prop** — absorb the caller's markup instead of minting `CardButton`.
4. **A provider or slot** — for **cross-cutting** state (theme, locale, a Field context) and for
   composite reuse. Not for "this input has completion".
5. **A new component.** Only now.

### A menu is a command; a listbox is a value

Half the "which control?" questions here are one question wearing four hats, and the answer is an
ARIA role, not a look. **If closing the surface leaves state, it is a listbox; if it leaves only an
effect, it is a menu.** The rest of the family is two orthogonal questions on top of that.

| | Type to filter | Options come from | Many |
|---|---|---|---|
| `NativeSelect` | no | a closed collection | no — it is the OS picker |
| `Select` | no | a closed collection | `multiple` |
| `Listbox` | no | a closed collection | `selectionMode` — and **no popover of its own** |
| `Combobox` | **yes** | closed, or free with `allowCustomValue` | `multiple` |
| `TagsInput` | n/a | **there is no collection** — the user invents the values | always |

`TagsInput` does not belong to the family: if the values exist beforehand it is the wrong answer and
`Combobox multiple` is right. **Autocomplete is not a component** — Ark has no such machine, and the
difference is `showTrigger` on `Combobox`. **`Command` is the honest exception**: a combobox held
permanently open, because the role follows the *interaction* rather than the payload, and a menu
cannot filter at all. Read the rule as *a value needs a listbox; a command needs a menu unless it
needs to be searched.* It bites hardest on filters — `decisions/a-filter-is-a-value.md`.

## Where specificity is allowed to live

`docs/showcases/` for full arrangements — an app shell, a workspace, an editor — rendered full-bleed
and unframed, because a shell judged inside a centred box tells you nothing. The products for
anything that knows a domain, any router integration, any validation engine, any persistence. Those
are respectable destinations, not rejections.

## Decisions

One file each in `decisions/`. `Status` `live` is a rule in force; anything else is history and can
be skipped.

**Live** — `a-count-belongs-in-a-script`, `a-layout-tree-is-children`, `a-primitive-owns-its-slot`,
`adoption-before-design`, `an-export-needs-a-second-call-site`,
`a-machine-with-a-switch-is-a-variant`, `a-region-carries-no-aesthetic`, `exactly-one-main`,
`a-shell-has-two-legal-shapes`, `layout-is-not-ark-native`, `a-filter-is-a-value`,
`a-grammar-ships-its-whole-vocabulary`, `charts-and-table-ship-code-forms-ship-a-guide`,
`a-chart-fails-silently-and-well-painted`, `ai-assist-composes-over-pure-inputs`,
`one-theme-provider`, `palette-is-authoring-time`, `one-changeset-until-the-first-publish`,
`match-the-reference`, `provenance-beats-purity`, `an-audit-is-a-map-not-an-oracle`,
`a-rule-broken-three-times-becomes-a-test`, `a-docs-defect-is-a-library-defect`,
`a-generated-index-with-no-second-list`, `a-name-shark-ships-is-ours`,
`a-measurement-overrules-the-reference`, `a-house-principle-withholds-no-name`.

Also live — `a-compound-keeps-its-root-even-when-the-root-is-an-alias`.

**Open** — `prose-that-is-hashed-is-data`: the convention holds, the code change it asks for has
not landed. `steps-claims-a-tab-role-it-cannot-keep`: needs a product decision on `linear` and an
upstream report.

**Superseded** — `field-has-no-consumer`, by `adoption-before-design`.
