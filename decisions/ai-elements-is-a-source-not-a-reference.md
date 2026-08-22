# AI Elements is a source, not a reference

- **Status** live — 2026-08-20
- **Decided** `@kanzo-tech/ai` takes its shapes and its state vocabulary from Vercel's AI Elements
  and its names from this house. There is no second parity snapshot and no second divergences file;
  Shark UI remains the only *reference*, and it governs `@kanzo-tech/ui` alone.
- **Because** a reference is a thing you can be held to, and holding a package to a registry we
  cannot install would buy a check nobody can run.
- **Reversed by** a shipped npm package we can resolve types from, which is what would make parity
  checkable rather than aspirational.
- **Held by** `packages/ui/src/shark-parity.test.ts`, "ships every name Shark ships, or declares why
  not"; `packages/ui/src/shark-surface.json`

The distinction the field names is the one `CONVENTIONS.md` already draws — *the reference governs
the surface, a measurement overrules the reference, a house principle overrules neither*. That
sentence is singular on purpose, and adding a second reference would have meant answering, for every
name, which of the two governs. The cost of the looser relationship is real and is the thing to
watch: nothing fails when we drift from AI Elements, so drift is invisible here in a way it is not
one package along.

What we took, and what we did not:

- **Taken whole**: the four tool states, collapsed to `pending | running | done | failed`, and the
  rule that a finished call opens by default. The transcript's pin-to-bottom behaviour, which is the
  only part of a conversation that is not markup. Reasoning opening while it streams and closing
  when it stops.
- **Taken and re-pointed**: their `StackTrace` became `Diagnostic` in `@kanzo-tech/ui`, because a
  severity, a message and a list of source positions is a SHACL violation and an LSP diagnostic, and
  neither is AI. Their `SchemaDisplay` loses its REST half.
- **Refused**: `ToolInput` and `ToolOutput` taking `input`/`output` props rendered as JSON. That is
  right for a chatbot that cannot know what the tool was; we always know, and rendering a SQL
  statement as a JSON blob discards it. Ours take children and fall back to a JSON rendering.
- **Not built**: the Voice family, Artifact, Web Preview and Sandbox — no call site, present or
  planned — and Canvas / Node / Edge, which was wanted for a fossil program summary that turns out
  to be a list of signatures rather than a diagram.
