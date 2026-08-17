# A look declares what it changes

- **Status** open — 2026-08-17
- **Decided** *(proposed)* The three shipped looks stop being three parallel tables of ten fields.
  Six of those fields are shared and become the form's defaults; a look declares only what it moves.
  And what reaches the preferences panel is the **axes a reader can name** — the mark, the links, the
  label budget — rather than one bundle whose contents nobody can describe.
- **Because** two of the three differ by amounts no reader can see, so the panel is about to offer a
  choice between two pictures that are the same picture.
- **Reversed by** a reader distinguishing Nebula from Atlas in a blind pairing. The claim below is
  that six of ten fields are under the threshold; one person telling them apart on those fields ends
  it.
- **Held by** `packages/graph/src/graph-looks.ts`, `MARKS`; `packages/graph/src/obligations.ts`,
  `link-curve`

## The working

The three shipped constants, field by field, read off `graph-looks.ts`:

| field | nebula | atlas | ink | nebula → atlas |
|---|---|---|---|---|
| point radius | 2 → 8 | 2.2 → 9 | **4 → 13** | +10% / +12.5% |
| link opacity | 0.42 | 0.45 | **0.28** | +7% |
| link width | 0.6 | 0.7 | 0.5 | +0.1 px |
| link fade | 200–1400 | 220–1500 | 180–1200 | ±10% |
| **link curve** | 0 | **0.12** | 0 | straight → bowed |
| **additive links** | **yes** | no | no | on → off |
| **label budget** | **14** | **26** | **40** | ×1.9 |
| **vignette** | **yes** | no | no | on → off |

**Six of the ten fields separate Nebula from Atlas by 7–17%**: two tenths of a pixel of radius, one
tenth of a line width, twenty pixels of fade distance, three points of opacity. Those are below the
differences the same file already treats as meaningful — its own shape-floor argument turns on a
luminance JND of 6.5–11.3 ΔL\*, and a 7% opacity change is nowhere near it. What actually separates
the two is four fields, and **three of them are about links or text rather than about form**:
additive blending, curvature, the label budget, the vignette.

**Ink is a real form.** Its marks are twice the radius, its links a third dimmer, its label budget
nearly three times Nebula's. Nothing here proposes merging it.

## What this means for the panel, which is where it gets frozen

The graph contributes **tokens** today — `LOOK_SECTION`, six colour bindings — and no *preference* at
all: the look and display controls live in the workspace showcase's own dock. `.planning/ROADMAP.md`
wants Look and Display to become a contributed section, and that is the moment this stops being an
internal table and becomes a list of names a user reads.

A contributed preference should name something a reader can name. On the numbers above, the honest
axes are:

| axis | kind | values | what it moves |
|---|---|---|---|
| mark | `choice` | dense · legible | radius, and the label budget that follows from it |
| links | `choice` | flow · diagram | additive + straight + dim, against opaque + bowed |
| labels | `range` | a budget | already a number in all three |

Two axes of two values **recover all three shipped looks and add one coherent fourth** — legible
marks with flow links — with six fewer numbers and nothing invented. The vignette either dies with
Nebula or is a `toggle`; it is the one field that is decoration rather than legibility.

## The open question, which is not ours

How many **names** the panel offers is a product decision, not a measurement, and it is the reason
this record is `open` rather than live. Three shapes, all consistent with the table:

- **Two axes, four combinations.** The most honest, and the names Nebula/Atlas/Ink stop existing as
  names — they become compositions a host may still ship as presets.
- **Three names, honestly composed.** Keep the names, delete the six jitter fields so each declares
  only what it changes, and accept that Nebula and Atlas differ in four things rather than ten.
- **Both.** The axes are what the panel offers; the three names live on in the host as pairings, the
  way [the channel bindings already do](a-look-is-form-and-a-channel-is-a-binding.md).

## Half of it landed, and it is the half that needed no product call

`MARKS` is the mark axis — `dense` and `legible`, each carrying the radius range **and the link
opacity and width that ride with it**, which is what the clustering says rather than a tidy guess:
0.42 and 0.45 on the two dense forms against 0.28 on the legible one. A form is now composed from a
mark, what its links do, a label budget and a rim, so **each look declares only what it changes**.

What that removed, and what it cost:

| | before | after |
|---|---|---|
| nebula | 10 fields | dense · straight+additive · 14 labels · vignette |
| atlas | 10 fields | dense · bowed · 26 labels |
| ink | 10 fields | legible · straight · 40 labels |

Nebula and Atlas now differ in exactly the four fields the table above says they differ in. Four
values moved to get there and every one of them is under the threshold this file argues from:
Atlas's radius 2.2 → 2 and 9 → 8, its link opacity 0.45 → 0.42, its width 0.7 → 0.6, and the three
fade ranges collapsed to one. **A screenshot cannot settle whether that was invisible, which is the
point of the claim** — the reversal condition above is a reader telling them apart, not a picture.

**Still open, and it is the naming half**: what the panel offers. Nothing in this change reaches a
user — `LOOKS`, `LOOK_ORDER` and `LookId` are byte-identical in shape, so the showcase's dock and
the pairings beside it did not move.

## What this does not touch

- **`Look` is still form.** This is about how many fields a form declares and what a reader is
  offered, not about the encoding, which left in the record above.
- **`Display`.** Its two multipliers — point scale, link opacity — are live controls over whatever a
  look computed, and they are the reason a preset is not a stamp. They stay whichever shape wins.
- **The obligations.** `link-curve` grades the largest curvature any look asks for, and it grades
  the same number whether that number lives in three tables or one.
