# A grammar ships its whole vocabulary

- **Status** live — 2026-07-30
- **Decided** The chart mark and interactor wrappers stay, and stay complete, even where no example
  draws one. This is the one standing exception to admission rule 2. It covers `/analytics` only:
  one-line descriptors over somebody else's grammar, and the re-exported aggregate vocabulary
  beside them.
- **Because** a vocabulary with holes sends the author to `@uwdata` for the one aggregate we left
  out, which is exactly the import this barrel exists to remove — and a mark you write yourself is
  a mark you write wrong. Curating a grammar costs more than cataloguing it.
- **Reversed by** the wrappers acquiring bodies. The exception is priced on their being one line
  each; a wrapper that grows logic is a component again and answers to the admission rules like
  everything else. It is also reversed by the grammar itself shrinking — a closed, named set is
  re-exported, an open one stays a direct import, which is the rule the `/analytics` surface was
  redrawn on.
- **Held by** `packages/ui/src/analytics.ts`, the notes on the aggregate exports and on the six
  withheld axis marks

The six marks withheld on purpose are part of the same decision, and they are the shape of its
limit: axes here compile to plot *attributes*, so an axis mark would steal the binding from the
interactor after it. A vocabulary is complete where completeness is free and withheld where it
breaks the layer.
