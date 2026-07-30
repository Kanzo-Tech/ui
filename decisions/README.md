# decisions/

One file per decision. Five fields, no prose outside them.

```markdown
# A title that states the decision, not the topic

- **Status** live — 2026-07-30
- **Decided** What is true now, in the imperative.
- **Because** One line. The reason, not the evidence.
- **Reversed by** The evidence that would change it.
- **Held by** The test, comment or file that fails when the code stops matching.
```

**Why fields and not prose.** Any decision here may be reopened; the third standing constraint
says so. Reopening a paragraph means winning the argument again and appending a correction below
the claim — which is how `DESIGN.md` came to carry four sentences that were false and one argument
about a component that had been deleted. Reopening a record means editing `Status` and writing
`Because` once more.

**Rules for writing one.**

- `Status` is `live`, `superseded by <slug>`, or `open`. An agent that greps for `Status** live`
  has today's rules and has read no history.
- `Because` may not contain a number. Numbers rot; they belong in `Held by`, where a test runs
  them. Every false claim the guidance audit found was a number or a line reference in prose.
- `Held by` cites a file and a symbol, never a line. Line numbers move without anyone noticing.
- A superseded record is edited, never deleted, and never rewritten to agree with its successor.
  It is the only surviving argument for the position that lost.
- No record restates a rule. `DESIGN.md` says what the system is, `CONVENTIONS.md` says how to
  write a file, and both link here for why.

The three standing constraints are not decisions and are not here. They are in `CLAUDE.md`.
