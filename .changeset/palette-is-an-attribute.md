---
"@kanzo-tech/palette": major
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

**A palette becomes an attribute: `compile(doc, { scope })` replaces `elevate`, and the provider's
`palette` preference finally applies something.**

Colour was the one axis not driven by a `data-*` attribute. A document was a whole stylesheet, so
the server read a cookie and served the chosen one before the first byte, and
`KanzoThemeProvider`'s own JSDoc said of its `palettes` prop: *"Wiring this does not apply
anything."* Three things followed — no preview, no scoped theming, no palette switch without a
round trip — and all three were presented as consequences of what a document **is**.

They were consequences of an assumption about size that was never measured. The five documents this
package ships are **58 kB raw and 7.6 kB gzipped together** — the reference layer is repetitive and
compresses hard. So every document travels and an attribute selects, which is what daisyUI has
always done with `data-theme`.

- `compile(doc, { scope })` emits under `[data-palette="<id>"]`. The selector is a **list** and both
  members are load-bearing: on `<html>` the bare attribute ties with `:root` at (0,1,0), so
  `[data-palette="x"]:root` at (0,2,0) is what wins; on a **div** — a preview showing one palette
  inside a page painted with another — `:root` cannot match at all, so the unqualified member is
  what applies. Neither case depends on which stylesheet the browser saw last.
- An identity is prefixed by its document (`[data-palette="bank"][data-identity="private"]`), so two
  tenants may both publish a `retail` brand.
- **`CompileOptions.elevate` is gone.** It existed to break a source-order tie between two documents
  that both claimed `:root`; scoping means they never both claim it.
- `AXES` gains `data-palette`, so `KanzoThemeProvider` and `themeScript` write it like every other
  axis, and the pre-paint script applies it before anything is drawn.
- **`cookieStorageAdapter` stops being mandatory** for a multi-palette tenant. It was required
  because a decision the server had already taken could not be corrected in the browser without a
  flash; there is no such decision now.

`tokens.css` still carries the default document unscoped at `:root`, so a tenant with one palette
gets the `<html>` and the stylesheet it had before.

Four tests asserted the old model in so many words — *"a document is served, never selected in the
cascade"*, *"an attribute here would match nothing in any compiled sheet"* — and each has been
rewritten to state what changed rather than deleted.

See `.planning/COLOUR-REVIEW.md` §5.
