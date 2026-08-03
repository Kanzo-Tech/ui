---
"@kanzo-tech/palette": major
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

**A palette repaints keywords: syntax is derived per document, and thirteen roles become seven.**

`SYNTAX_SOURCE` was a constant — `{ light: "kanzo", dark: "kanzo-dark" }` — so all six shipped
documents declared the *same* 26 `--kanzo-syntax-*` values. Choosing Dracula gave you Dracula's
surfaces and Kanzo's keywords, while Dracula's own base16 slots sat unread in `palette-data.json`.
They were also the only `kind: "fixed"` values in the role table: literal hexes, neither derived nor
measured.

**Six roles dissolved instead of moving**, because they already had an owner and were duplicating a
tint the ramp publishes:

| was | is |
|---|---|
| `comment` | `--faint` — a gutter number, a field's placeholder and a code comment are one decision |
| `punctuation` | `--muted-foreground` |
| `operator` | `--foreground` — it already *was* the ink, under another name |
| `invalid` | `--destructive-foreground` |
| `inserted` / `deleted` / `changed` | `--success` / `--destructive` / `--warning` (already were) |

**The seven that remain are hues**, derived from the document's own scheme through four measured
obligations (`derive-syntax.ts`): AA on the active line, ΔE apart from each other, never louder than
the page's ink, and a **capacity** when a set cannot honestly name all seven. `kind: "fixed"` is
gone with them — it has no members left.

**Two constants came out of the corpus, not out of judgement**, and both corrected a first draft:

- `SYNTAX_SEPARATION` is **5**, not 8. The closest pair in any shipped scheme is Kanzo's own
  `#c10007`/`#ca3500` at 5.4, so a bar of 8 collapsed `identifier` onto the page ink in a set that
  has shipped for months.
- `SYNTAX_BAND` **maps** an out-of-mode lightness rather than clamping it. Clamping put all seven of
  Dracula's slots at the band roof and the AA pull then dropped them to exactly 4.50–4.53:1 — one
  colour with seven hues. Mapping keeps the spread its author built.

**A second live AA failure, fixed.** The gate graded syntax against `--background`; the harder
surface is `--editor-active-line` (base step 3) in both modes. Measured there,
`--kanzo-syntax-type` shipped at **4.30:1** — legible while you read someone else's line and not
while you edit your own. The cross-check row is `syntax-on-active-line` now.

**What moves and what does not.** Kanzo's dark set is byte-identical (zero adjustments); its light
set moves one value, the `type` that was failing. Dracula, Nord and both Catppuccins get their own
syntax for the first time — `#ff79c6`, `#b48ead`, `#cba6f7`. Nord read onto a light page reports
capacity 5 of 7 and says so rather than inventing hues.

**Breaking**: `--kanzo-syntax-*` → `--syntax-*` (seven), `--kanzo-editor-active-line` →
`--editor-active-line`, `--kanzo-gutter-bg` → `--editor-gutter`. `resolveRoles` takes a `SyntaxSet`.
`DerivePaletteInput` takes an optional `syntax` source; a client may bring base16, a VS Code theme's
`tokenColors`, or seven hexes, all read for their **hues** and re-solved against their own editor.

See `.planning/COLOUR-REVIEW.md` §8.
