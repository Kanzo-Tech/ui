# A ledger's columns are read from the shape, not written beside it

- **Status** live — 2026-08-18
- **Decided** The receipts showcase declares its columns once, as a SHACL node shape, and rudof parses and validates that document in wasm. The table's headers and order, the vision model's tool schema, the per-cell findings and the CSV's header row are four readings of it.
- **Because** A column written twice is a column that will disagree with itself, and here the disagreement leaves the building as a spreadsheet.
- **Reversed by** A consumer that needs something the shape cannot say, or a wasm payload the docs build will not carry.
- **Held by** `docs/showcases/receipts/shape.ts`, `TICKET_SHAPE`; `docs/showcases/receipts/rudof.ts`, `openLedger`; `docs/showcases/receipts/csv.test.ts`, "writes the header from sh:name, in sh:order"

`@kanzo-tech/rudof-wasm` is the whole engine — `loadShapes` hands back the shape's own IR, so the
column list *is* the shape rather than a transcription of it, and `validate` is the real SHACL
validator rather than a lookalike written in the showcase. The wasm is 2.7 MB unpacked and loads
lazily on mount; the docs build is green with it, which was the question that decided the design
and was checked before any of the screen was written.

The engine reports what the design needs and nothing was bent to make it fit. A `sh:pattern`
violation names the row and the column; so does a `minCount` violation, which is what turns a cell
the model could not read into a finding rather than a silent blank; so does `sh:in`. Each carries
the shape's own `sh:message`.

**The case that does not fit.** rudof returns its own message and the shape's `sh:message` in one
array with nothing marking which is which, and the order is not stable between runs. `spoken()` in
`rudof.ts` picks the one that does not say "not satisfied" — the single place this design guesses,
and it is a guess about the engine's wording, not about the shape.

**What this does not touch.** `@kanzo-tech/ui` still knows nothing about RDF: the admission rule at
the top of `index.tsx` bars it by name, and every line above lives in `docs/showcases/`. A showcase
is where specificity is allowed to live, and none of this is a candidate for the library until a
second call site asks for it.
