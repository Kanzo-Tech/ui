# Kanzo UI — reference design

What this system **is**. `CONVENTIONS.md` is the companion: how to write code inside it.

Written 2026-07-22, after a review that found the layout layer incoherent and traced the
incoherence to something more general — pieces that mix concerns, and a shape quietly dictated
by whichever product shouted loudest. This document exists so that conversation does not have
to happen again with a different layer next month.

---

## The governing constraint

> **This is our library, generic, for anything we want to build.**

Stronger than the existing *domain-free* rule. Domain-free stops RDF and auth from leaking in.
It does **not** stop a component's *shape* from being dictated by one consumer — which is how
`AppShell` ended up reading as "the metadata view" while being named as a general shell.

Two consequences, and the second is what makes the first affordable:

1. The library ships a **generic vocabulary**.
2. **Specific arrangements are showcases**, in `docs/blocks/`, not components.

An arrangement someone actually uses does not have to become a component. It has to become an
example.

---

## The three axes

Most confusion in this library came from single components spanning several of these. When
deciding where something belongs, name its axis first.

### Axis 1 — Structure

Where something sits, and what scrolls. Flex, height, overflow, min-width. **No appearance.**
A structural part has no opinion about colour, height, surface or typography.

### Axis 2 — Content

Titles, descriptions, actions, controls, text. Has appearance, driven by tokens and recipes.

### Axis 3 — Behaviour

State machines: focus, keyboard, ARIA, positioning, collision. **Ark owns this.** Where Ark has
no equivalent, we write it — and then we document the ARIA contract and cover it with a test.

**A part should sit on one axis.** `ShellBar` was rejected for spanning 1 and 2: it declared a
position *and* an IDE height, surface and typography. The correct split is a structural region
that positions, holding content the caller chose.

---

## The layers

| Directory | What lives there | Test |
|---|---|---|
| `simples/` | Single-purpose components — Button, Input, Dialog, Select | Does one thing |
| `composites/` | Assemblies of simples — SidebarUser, StatCard, CodeEditor | Made of several, still fits in a page |
| `layouts/` | Page and window scaffolding — the Shell regions | Positions other things |

The public barrel is **flat**, so moving between layers never breaks a consumer. That is what
makes taxonomy mistakes cheap to fix, and why they should be fixed rather than lived with.

### The naming rule

Discovered while writing the forms guide, and it explains half the library:

> **`kebab-case` is the vendored primitive. `PascalCase` is our pre-assembled convenience
> built on top of it.**

Verifiable, not asserted: `SecretField` imports `password-input`, `TextField` imports `input` +
`input-group`, `DateField` imports `date-picker` + `calendar`. They are not competitors — one is
built from the other. **Default to the PascalCase one; drop to the primitive when it does not
fit.**

---

## The layout layer

### Regions, and nothing else

```
ShellRoot                         full-height column, owns the viewport
├── ShellHeader                   ┐
├── ShellBody                     │ structural only:
│   ├── ShellAside side="start"   │ placement, the separating border,
│   ├── ShellMain                 │ what shrinks and what scrolls
│   └── ShellAside side="end"     │
└── ShellFooter                   ┘
```

**The regions carry no aesthetic.** No height, no surface, no typography, no font size. A region
places its children and separates itself from its neighbour. Everything visible inside it is the
caller's.

This is the correction that took three attempts to reach. `Toolbar`, `StatusBar` and
`TopBarUtility` were three copies of one strip; the first fix merged them into a generic
`ShellBar` — which kept `h-8`, `bg-card`, `text-muted-foreground` and an 11px font. That is the
IDE aesthetic of `Toolbar`, the component the owner had explicitly rejected. Generalising an
implementation while preserving a rejected appearance is not generalising.

**So there is no bar component.** A dense IDE strip is *something you put in a region*, and it
lives in the workspace showcase where anyone who wants that look can copy it.

### Rules that survive any refactor

- **Exactly one `<main>` per page.** `ShellMain` owns it. Nested containers use `<section>`; two
  `<main>` elements are a conformance error and make "skip to main content" ambiguous.
- **Logical properties, never physical.** `border-e` / `border-s`, `side="start" | "end"` — never
  left/right. One code path mirrors correctly under RTL.
- **Asides are `<aside>`**, i.e. complementary landmarks, which is why they may repeat where
  `<main>` may not. Two of them need `aria-label` to be distinguishable.
- **Resizing is composed, not a prop.** Wrap Ark's Splitter around a region and the drag,
  keyboard resize and ARIA come from the machine.
- **A region declares no role.** A bottom region is often `contentinfo`, a top one often
  `banner`, a strip is neither — and a shell may have several. The call site passes the landmark.

### What the current components become

| Today | Becomes |
|---|---|
| `AppShell` | showcase |
| `WorkspaceLayout` | showcase — its `localStorage` persistence, portal glue and global Escape listener go with it, not into the library |
| `TwoPaneLayout` | deleted — one `ShellAside` + `ShellMain` is already that |
| `SidePanel` | `ShellAside` (its narrow drawer is the `overlay` variant) |
| `Toolbar`, `StatusBar`, `TopBarUtility` | deleted — content inside a region |
| `TopBar` | splits three ways: the `<header role="banner">` is a region, the utility strip is content, the title row is a header (below) |
| `PageShell`, `SectionHeader`, `TopBarMain` | merge — one header vocabulary, in Ark's compound idiom, with a scale variant |

### The header rule

Three vocabularies describe one row today — `SectionHeader` (Icon · Content · Title ·
Description · Actions), `PageShell` (Header · Title · Description · Actions) and `TopBarMain`
(TitleGroup · Title · Subtitle · Actions). Same structure, three names.

They merge. `CardHeader` and `DialogHeader` do **not**:

> **A header wired to a machine stays with its machine. Only pure-layout headers merge.**

`DialogHeader` wires Ark's `aria-labelledby`; `CardHeader` is part of Card's compound. Precedent
that the line is right: `TourHeader` *is* `DialogHeader`. Sharing across machines is fine when
the wiring is shared; merging layout with wiring is not.

---

## Validation and errors

**The library displays errors. Products produce them.**

`Field` takes a boolean and a `ReactNode`. Where they came from — a zod schema, a server
response, a SHACL engine, an `if` — is the product's business.

The reasoning, in full, is in `.planning/FORMS-DECISION.md`. The short version: our own two
consumers validate in ways with almost nothing in common (schema-keyed vs RDF-term-keyed, binary
vs tri-state severity, one message vs several), so any model rich enough for both would be shaped
by whichever shouted loudest, and any model shaped by one excludes the other. A boolean and a
node exclude neither.

---

## Admission rules

A new component enters only if all four hold:

1. **Domain-free.** Nothing about RDF / SHACL / fossil / graphs / auth.
2. **Proven demand.** It appears in ≥2 real call sites, not in a hypothesis.
3. **Wraps, does not reinvent.** If it needs behaviour, it leans on Ark. Check
   `@ark-ui/react/dist/components/` before writing a state machine.
4. **Single axis.** It is structure, or content, or behaviour — not a blend.

And one rule about *not* building:

> **Do not add a model before the existing parts have a consumer.**

`field.tsx` ships thirteen parts and had no consumer while four rounds of design went into a
fourteenth. The highest-value move was adoption, not design.

---

## Where specificity is allowed to live

Not everything belongs in the library, and that is not a loss:

- **`docs/blocks/`** — full arrangements: an app shell, a workspace, an editor. Rendered
  full-bleed and unframed, because a shell judged inside a 450px centred box tells you nothing.
- **The products** — anything that knows a domain, any router integration, any validation engine,
  any persistence.

If a piece cannot pass the admission rules, it is a showcase or it is product code. Those are
respectable destinations, not rejections.
