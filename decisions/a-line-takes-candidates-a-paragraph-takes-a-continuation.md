# A line takes candidates, a paragraph takes a continuation

- **Status** live — 2026-08-21
- **Decided** `Complete` composes over a `Textarea` only; there is no `CompleteInput`. A one-line
  field is offered candidates with `Suggest`.
- **Because** a continuation drawn over an `<input>` can only show what fits in the width that is
  left, so a long offer is unreadable and taking it is taking it blind.
- **Reversed by** a single-line field whose offers are reliably short enough to fit, measured
  rather than assumed — or a browser giving an `<input>` a way to scroll text it does not contain.
- **Held by** `packages/ai/src/complete.tsx`, `CompleteTextarea`;
  `packages/ui/src/index.test.ts`, "drops components superseded by composition or a merge",
  `!CompleteTextarea`; `packages/ai/src/complete.test.tsx`,
  "streams an end-of-value ghost over a pure Textarea and Tab accepts it"

The overlay is a mirror: a box the size of the field, wearing its computed typography, holding the
value invisibly so the ghost starts exactly at the caret. It is parked at the field's own
`scrollLeft` so it scrolls when the field scrolls. That is the whole mechanism, and it is also the
limit — **the field's `scrollLeft` is a function of its value, and the ghost is not in its value.**
A `<textarea>` has an answer: it grows, and `CompleteGhost` raises its `min-height` to fit the
offer. An `<input>` has none. Everything past the remaining width was masked by a gradient and
unreachable by any gesture; the only way to read it was to accept a word at a time, which is
reading it after deciding.

The reference layer says the same thing by omission. Gmail's Smart Compose continues a message
body; Copilot continues a document in an editor. **No shipping product draws a ghost continuation
in a one-line form field** — where the field is one line, the offer is a list you pick from. We
already had that list.

**What this does not decide: the hook.** `useInlineCompletion` is headless and will drive anything
with a value and a caret, an `<input>` included. It stays that way, because a rule about what the
library *teaches* is not a reason to cripple the escape hatch. What changed is that no page here
demonstrates it over one line, and the two examples that did are deleted rather than annotated.

**The case that does not fit is `Editable`.** Ark's inline editable is a one-line control whose
whole point is that it is prose in place, and an example used to stream a continuation into it.
Under this rule it takes candidates, which reads oddly for a name being corrected in situ. It went
with the other example rather than being kept as an exception, because an exception is how a rule
stops being one — but that is the argument to bring if this is reopened.
