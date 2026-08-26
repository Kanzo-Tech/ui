# Forms — what we decided, and why we decided almost nothing

Written 2026-07-22, from a design discussion that went four rounds and ended somewhere
different from where it started. The reversals are recorded on purpose: the reasoning is
the valuable part, and the final answer only makes sense against what it rejected.

> **EVIDENCE. Reviewed 2026-08-26 and the decision still holds.** `/docs/design/admission` cites
> this file as *the full reasoning* behind "no validation model", and the rule there carries what
> would reverse it: a second validation consumer that agrees with the first about keys, severity
> and cardinality. Two have not. The only thing that has moved is the follow-up — "keasy migrates
> to the `Field` in the barrel" is parked, not done, and it is keasy's move rather than this repo's.

---

## The decision

**The library gets no new validation model. Not a `severity` prop, not a `FieldError` type,
not Standard Schema at the `Field` boundary. Nothing.**

The next move on forms is **adoption, not design**: keasy migrates to the `Field` that has
been sitting unused in the barrel since it was written.

---

## How we got here

The question started as *"should `@kanzo-tech/ui/form` wrap TanStack Form with an
Ark-shaped `Form.*` compound API?"* and became a much better question: *"how many models of
'a field error' should exist in our system?"*

Counting honestly, six already exist:

| Model | Where | Ours? |
|---|---|---|
| `ValidationResult` | metadata-form (`src/form/validation.ts`) — the SHACL/ShEx engine's output | no |
| `FieldError` | metadata-form — per-field, message already resolved and localised | no |
| TanStack's error map | proposed for keasy | no |
| zod issues | keasy (and metadata-form, which has `zod >=3.23` as a peer) | no |
| `Issue` from `@standard-schema/spec` | already in the lockfile at 1.1.0 | no |
| `invalid: boolean` | our `Field` | **yes** |

Every intermediate proposal in the discussion **added a seventh**. That is the test each one
failed.

### What was proposed and rejected

**1. Adopt Standard Schema's `Issue` as the `Field` contract.**
Rejected. `Issue` is `{ message, path }`, and `path` is meaningless at the `Field` boundary —
a `Field` is already scoped to one field. We would have used one of its two fields and added
`severity`, producing a dialect rather than adopting a standard. Standard Schema matters at
the `/form` ↔ validation-library seam, where TanStack and zod already speak it to each other
and we write zero lines.

**2. Give `Field` a `{ message, severity }` contract.**
Rejected, though this was the closest call. It would have *replaced* metadata-form's
`FieldError` rather than adding to it, so the net count went down. But it was still a new
model designed from one consumer's type definition, with no usage evidence behind it.

**3. Reuse the existing `variant` vocabulary (`destructive`/`warning`/`info`/`success`).**
Rejected, but it produced the best argument of the discussion, which survives below. The flaw:
`Alert`'s `variant` tints a whole component, while here it would tint a sub-part — homonymy,
not consistency.

### What actually settled it

`packages/ui/src/simples/field.tsx` **already has thirteen parts**: `Field`, `FieldSet`,
`FieldLegend`, `FieldGroup`, `FieldContent`, `FieldLabel`, `FieldRequiredIndicator`,
`FieldTitle`, `FieldDescription`, `FieldSeparator`, `FieldHelper`, `FieldError`.

`FieldError` exists. `FieldDescription` exists. `FieldHelper` exists. We spent four rounds
designing a fourteenth thing for a component whose thirteen existing parts **have no consumer
at all**.

---

## The argument that survives

Worth keeping even though it did not win, because it will come back:

The design system already speaks a four-family status vocabulary, consistently —
tokens (`--destructive`, `--info`, `--success`, `--warning`, each with `-foreground`),
`Alert` (`default | destructive | info | warning | success`) and `Status`
(`default | success | info | warning`). `Field` speaking only binary `invalid` is the odd one
out, and that is an internal inconsistency **that does not require any consumer to notice it**.

So if the need for non-blocking field messages ever proves itself, the answer is already
constrained: it is a **part** (`FieldWarning`), matching the idiom of the other thirteen —
not a `severity` prop, not a new type, not `variant` borrowed from `Alert`.

The tell that this vocabulary is genuinely generic rather than consumer-shaped: it yields
`success` on a field ("name available", "password strong enough") — a case **neither**
consumer asked for.

---

## Why the library must not own error *production*

This is the durable half, and it is what keeps the library generic.

metadata-form is the counter-example that breaks any single validation model:

| | TanStack / zod | metadata-form |
|---|---|---|
| Who validates | validators declared beside the form | an external SHACL/ShEx engine, over the **whole graph** |
| Error key | `items[0].email` | `${focusNode}\|${path}` — RDF terms |
| Severity | binary | tri-state: `violation` / `warning` / `info` |
| Message | from the schema | already resolved and localised (author's multilingual `sh:message` → catalogue → fallback) |
| Cardinality | one | `FieldError[]` per field |

And above it sits a whole derived `FormReport` — progress, issues per group, rows for a
summary, even a `FormMood` — which is a form-level model the library has no business owning.

**Could TanStack host this?** Partly, and more than first credited: its `validators` accept
arbitrary functions, a form-level validator can return a per-field error map (exactly SHACL's
shape), and errors can be objects, so severity would ride along. *(Asserted from the v1 docs —
`@tanstack/react-form` is **not installed**; only `@tanstack/react-table` is. Verify before
relying on it.)*

Three things still block it, and the third is decisive:

1. **Two sources of truth.** TanStack owns a `values` object; metadata-form's values live in
   the RDF graph, committed via `useCommit`. Either duplicate and sync both ways, or run
   TanStack with empty values as a pure error bus — using ~5% of it.
2. **Field identity.** TanStack keys by a path into `values`. Here identity is `focusNode|path`.
   Encodable as a string, but then "values" is a dictionary keyed by IRI pairs pretending to be
   a values object.
3. **The payoff is structurally unavailable.** The reason to choose TanStack is end-to-end type
   inference from a statically known `defaultValues`. This form's shape comes from SHACL shapes
   **at runtime**, so values are `Record<string, unknown>`. You carry the dependency and never
   collect the benefit.

For keasy — static forms, zod schemas — TanStack remains a clear win. For metadata-form it is
a dependency whose main benefit cannot exist.

**Conclusion: the library owns error *presentation*; consumers own error *production*.**
`/form` stays an optional peer on a subpath, for the consumers that want it. Anything
engine-specific stays in the product.

---

## What to do instead — in order

1. **Adopt.** keasy's `FormField` (30 LOC, 8 call sites) has the `<Label>` without `htmlFor`
   and passes no `id` to its child: **there is no label↔control association in eight screens**.
   It also neither accepts nor renders `error`, and none of keasy's three forms shows field
   errors at all — the only signal to the user is a disabled button. Our `Field` fixes both by
   construction, today, with **zero library changes**. This is the single highest-value move
   available and it requires no design.
2. **Document.** A Forms guide in the docs (`docs/content/docs/forms/`), because the review
   found the forms story unintelligible: *"no entiendo el tema de With field, es lo mismo, no?"*.
   A repeated `example-with-field` across a dozen pages explains nothing.
3. **Observe.** Let the thirteen parts get real use before anyone proposes a fourteenth.
4. **Only then** revisit `/form` and TanStack, with evidence instead of speculation.

The (now deleted) new-components proposal stands as written except for its sequencing: wave 3 begins with
adoption, not with `createKanzoForm`.

---

## The meta-lesson

The first three answers in this discussion were all designed **backwards from two consumers**.
That is how you get a library that fits exactly those two and nothing else. The owner's
correction — *"no quiero que esta librería sea específica, quiero que sea nuestra librería,
genérica, para cualquier cosa que queramos construir"* — is the constraint that should be
applied to every future admission decision, and it is sharper than the existing "domain-free"
rule: domain-free stops RDF from leaking in, but it does not stop a *shape* from being quietly
dictated by whoever happens to be the loudest consumer.
