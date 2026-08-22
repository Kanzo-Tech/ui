# A categorical set may use the palette's own colours

- **Status** superseded by `a-theme-is-one-flat-block` — 2026-08-21
- **Decided** The categorical source becomes the brand wheel **plus the colours this document already
  publishes** — the syntax source's own accents — deduplicated by hue family, the document's colour
  winning where both name one. Those families are then **required**, and if requiring them puts the
  set under the separation bar the requirement is dropped and the same source is searched again. A
  document with no authored source (a client's two hexes) is unchanged: it has no accents to add.
- **Because** the syntax half already reads a palette's own accents and the categorical half never
  did, so a document painted its keywords in its own colours and its charts in somebody else's.
- **Reversed by** a client reporting that their charts moved to colours they did not choose. The
  wheel's answer is *derived* and the accents are *authored*, and a tenant who liked the derived one
  has no way back if this is not per-document.
- **Held by** `decisions/a-theme-is-one-flat-block.md`, which carries the rule that replaced this one, and the guards it names

## The working

`node packages/palette/scripts/measure-categorical-source.mjs`, over the four documents that have
authored accents to read. `cap` is how many real categories the set names, `light`/`dark` the worst
adjacent pair under CVD simulation, `own` how many of the families the palette itself publishes
survived, and a score — the lower of the two modes — under `SEPARATION_BAR` (15) is a **refusal**.

| document | option | cap | light | dark | own | ms |
|---|---|---|---|---|---|---|
| dracula | A wheel (today) | 7 | 20.5 | 15.5 | 3/6 | 272 |
| dracula | B its accents | 4 | 16.8 | 16.8 | 4/6 | 21 |
| dracula | E union, required | 8 | 15.5 | **12.7** | 6/6 | 1109 |
| dracula | F union, offered | 8 | 21.2 | 21.2 | 4/6 | 15300 |
| nord | A wheel (today) | 8 | 20.9 | 20.9 | 1/1 | 208 |
| nord | B its accents | **0** | — | — | 1/1 | 0 |
| nord | E union, required | 8 | 20.9 | 20.9 | 1/1 | 211 |
| catppuccin-latte | A wheel (today) | 8 | 20.8 | 20.9 | 4/6 | 1624 |
| catppuccin-latte | B its accents | 5 | 33.1 | 33.4 | 5/6 | 297 |
| catppuccin-latte | E union, required | 8 | 20.9 | 20.9 | **6/6** | 3268 |
| catppuccin-mocha | A wheel (today) | 8 | 20.3 | 20.3 | 3/5 | 767 |
| catppuccin-mocha | B its accents | 5 | 19.7 | 17.2 | 5/5 | 4 |
| catppuccin-mocha | E union, required | 8 | **22.4** | **26.0** | **5/5** | 2222 |

Three things the numbers settle, and the first is the one worth knowing:

- **The obvious fix is wrong.** Sourcing from a palette's own accents *instead* of the wheel — option
  B — costs three or four categories on every document, and on **Nord it refuses outright**: its
  accents are pastels below the chroma floor, so seven of the eight drop and the set can name
  nothing. A palette's accents were authored to sit in an editor, not to be told apart as marks.
- **Requiring identity can break the guarantee, and on Dracula it does.** Forcing all six of its
  families scores 12.7 against a bar of 15 — a refusal, so the set that comes back cleared nothing.
  `SEPARATION_BAR`'s own comment predicted this before the measurement existed: *13.7, under the bar,
  when every family is forced.* Hence the fallback: the guarantee wins over the resemblance.
- **The union is a superset of the wheel, so the search can only do better.** Every document improves
  or stays level — Dracula 7 → 8 categories with the dark mode's worst pair going 15.5 → 21.2,
  Catppuccin Latte holding 20.9 while its own families go 4/6 → 6/6, Mocha improving on all three
  axes at once. No document regresses on any axis, which is what makes this cheap to accept.

## What it costs, and where

Time, in the one place that can afford it. The search is combinatorial in the family count, so a
source that grows from eight families to eleven grows the *fast* path from 0.2–1.6 s to 0.2–3.3 s
per document, and a refusal costs a second pass — Dracula's is 15.3 s, which is what the fallback is
worth paying to keep the bar.

That lands entirely at authoring time and mostly at *our* build: `gen-palette` adds around twenty
seconds. A tenant registering a palette from two hexes has no authored accents, so nothing about
their derivation changes. The onboarding showcase derives a hall's heraldry — also two hexes — so
the interactive path is untouched.

## What this does not touch

- **The syntax half.** It already reads the accents and keeps reading them; this record only stops
  the categorical half from ignoring the same source.
- **The status fills.** A set still avoids them in both modes, and that is what keeps a series from
  reading as a state.
- **A declined document.** `monochrome` publishes no set at all, so there is no source to widen —
  see [monochrome is a palette](monochrome-is-a-palette-not-a-look.md).

## What landed, and the one document the table did not cover

`searchScheme` in the derivation, and the source of the authored colours is **the syntax source
this document already carries** — `input.syntax`, never the fallback. That distinction is the whole
of the rule: the fallback is *Kanzo's* accents, so reading it would hand a client somebody else's
colours under the name of their own. It also means this reaches every document with a source of its
own, not only the base16 ones — a client bringing seven hexes gets the same treatment.

`source.from` gained `authored-and-wheel`, because a document that read its own colours and one that
had none to read are different facts and were about to report the same one.

**The document the table did not cover is Kanzo's own, and it moved the most.** Its brand is grey, so
it has no wheel — the default scheme stands in — but it *does* publish accents, and requiring them
took the worst adjacent pair from **20.9 to 28.3 light / 28.5 dark** at the same eight categories.
The default document's chart colours therefore changed, which is the one visible consequence of this
record and the reason the compile fixture now declares `--chart-*` among its licensed differences from
the v2 fixture. That exclusion is paid for: the same test asserts the eight slots are eight distinct
colours and that none folded to `OTHER`, so "the charts may differ" cannot come to mean "the charts
quietly collapsed".

The measured claim beside `SEPARATION_BAR` was updated with it — 13.3 ΔE of headroom against 28.3,
where it used to say 5.9 against 20.9. The bar itself did not move, and the Dracula curve that pins
it is unchanged.
