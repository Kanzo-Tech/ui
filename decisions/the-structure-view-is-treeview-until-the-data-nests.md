# The structure view is TreeView until the data nests

- **Status** live — 2026-08-21
- **Decided** The library ships no schema display. A structure — a shape's fields, a relation's
  columns, a module's declarations — is rendered with `TreeView` where it nests and `DataList` where
  it does not. This declines AI Elements' `SchemaDisplay`, assistant-ui's spec sheet, and the
  `Declaration` the AI-layer memo gated, which are one question under three names.
- **Because** neither shape document we ship has recursive data, so a tree buys nothing over a
  labelled list.
- **Reversed by** a shape that nests — `sh:node`, `sh:or`, `sh:xone` — or a second renderer for the
  flat case. fossil's outline gaining nesting and a type is the same condition reached from the
  other side.
- **Held by** `docs/showcases/field-notes/rudof.ts`, `Column`; `docs/showcases/discovery/data.ts`,
  `Relation`; `packages/ui/src/simples/tree-view.tsx`, `TreeViewItem`

## The working

The boundary object exists and it is flat. `rudof.ts`'s `Column` is what a real SHACL parse produces
here — a key, an IRI, a label, an order, a type, a pattern, an option list and a required flag — one
`sh:` characteristic each, and it survives the round trip to both other dialects intact: `live.ts`
compiles the same list into JSON Schema for a vision model and into one prose line per field.
`discovery`'s `Relation` is the same thing without the constraints.

Re-derive the nesting claim over the two shapes we ship:

```
grep -cE 'sh:(node|or|xone|and|not) ' docs/showcases/field-notes/shape.ts
```

The trailing space matters — a bare `sh:or` false-matches `sh:order`.

## The case that does not fit

`docs/showcases/discovery/default.tsx`'s `Schema` **is** a hand-rolled schema display: a relation
name, a row count, a note and a field list. That is one renderer, and
`an-export-needs-a-second-call-site.md` asks for two. It is also below what a component could give,
visibly — `discovery/data.ts` types its fields as strings with the name and the type crammed into
one, so a component could not render them apart without that call site being rewritten first.

Two showcases that look like they should count do not. `metadata-form` holds no shape at all: it was
re-seeded into the Guild fixture world and its rule engine is deliberately faked, so its rule panel
is a `<pre>` of numbered lines *because* a diagnostic frame points at a line. `field-notes` does hold
one and shows it as **source**, in a `CodeEditor`, editable — `shape.ts` states the reason, which is
that the panel and the engine cannot drift apart because they are the same string. A display cannot
be an editor, so replacing it would be overturning a stated design reason to manufacture the call
site this record is missing.

## What this does not touch

Not `Diagnostic`, which took the other half of the same upstream component and shipped on a
different test. Not `JsonTreeView`, which renders a value and would need a second interpretation of
one prop to render a meaning. And not the question of which package: were this ever shipped, a
component that paints a schema does not know a model exists, so it would go to `@kanzo-tech/ui` by
`the-ai-surfaces-are-their-own-package.md`'s line — the same line that placed `Diagnostic` and
`Suggestions` there.
