# decisions/

One file per decision. Five fields, first and in order, and nothing else above them. Below them,
prose — most records have it, and the good ones are mostly it.

```markdown
# A title that states the decision, not the topic

- **Status** live — 2026-07-30
- **Decided** What is true now, in the imperative.
- **Because** One line. The reason, not the evidence.
- **Reversed by** The evidence that would change it.
- **Held by** The test, comment or file that fails when the code stops matching.
```

**Why fields first.** Any decision here may be reopened; the third standing constraint says so.
Reopening a paragraph means winning the argument again and appending a correction below the claim —
which is how `DESIGN.md` came to carry four sentences that were false and one argument about a
component that had been deleted. Reopening a record means editing `Status` and writing `Because`
once more. That only works while the five fields are the whole of what a reader has to trust: an
agent greps `Status** live`, reads `Decided`, and is done.

**What the prose below them is for.** The fields carry the decision; the body carries the
*evidence* — what was measured, what was checked against the reference, what the argument cost, and
which case broke the rule. It is what makes a record checkable by somebody who was not in the
argument, and it is the half that survives being wrong. Three things belong there and nothing else:

- **the working, and where a reader can re-run it** — the file read, the count and the command that
  re-derives it, the upstream source fetched;
- **the case that does not fit**, named rather than smoothed over — every record in this corpus that
  earns its length is one that says *except this one, and here is why*;
- **what the decision does not touch**, so the next reader does not over-apply it.

Not belonging there: restating the fields at length, re-arguing a position the fields already
settled, or narrating the session. If a paragraph is not something a later reader could check or be
saved by, it is the licence to ramble that the fields exist to prevent — cut it.

**Rules for writing one.**

- `Status` is `live`, `superseded by <slug>`, or `open`. An agent that greps for `Status** live`
  has today's rules and has read no history.
- `Because` may not contain a number. Numbers rot; they belong in `Held by`, where a test runs
  them. Every false claim the guidance audit found was a number or a line reference in prose.
- `Held by` cites a file and a symbol, never a line. Line numbers move without anyone noticing.
  - **A test cited by name is cited by its `it()`, quoted.** `packages/ui/src/index.test.ts`,
    "exposes exactly one themer" — not the title as you remember it, and never a comment. The guard
    checks the assertion exists, because a record saying *a test holds this* was the single most
    common false claim in the corpus.
  - **A claim that a name is gone is written `` `!Name` ``.** `packages/ui/src/index.test.ts`,
    `!TextField` means *that file asserts `TextField` is off the public surface*. The guard imports
    the barrel and checks it. Write it whenever a record's argument depends on an absence: prose
    saying "the export has since been removed" is unfalsifiable, it was wrong about `ProgressTrack`
    within hours, and a reader who believed it deleted a shipped export.
- **The outward-reaching sentence is the one that rots.** Not one record in the first audit was
  wrong about its own subject; twenty-six were wrong about something else — *a test holds this*,
  *this is the only one*, *the count is N* — and almost all were falsified within two days by the
  same work that wrote them. If a claim reaches outside the record, either cite the file that would
  fail or do not make it. A uniqueness claim ("the only", "nothing else", "every") names the file
  that enumerates the set, or it goes.
- A superseded record is edited, never deleted, and never rewritten to agree with its successor.
  It is the only surviving argument for the position that lost.
- No record restates a rule. `DESIGN.md` says what the system is, `CONVENTIONS.md` says how to
  write a file, and both link here for why.

The three standing constraints are not decisions and are not here. They are in `CLAUDE.md`.
