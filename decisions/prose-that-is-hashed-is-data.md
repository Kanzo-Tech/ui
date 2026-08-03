# Prose that is hashed is data, and a digest takes only the fields it claims

- **Status** live — 2026-08-03. The code change landed, and the freeze it imposed is lifted.
- **Decided** `hashObligations` digests each obligation's `{ step, id }`, not the whole row. The
  `reason` strings are prose again and may be corrected. While the digest was taken over the row
  they were **data**, which froze one measurement that was known to be wrong for three days:
  `control-boundary` cited a 118-seed corpus where `Ramp.boundary` records 116, with different
  splits either side. Both now read 116 — light 9 for 91 and 8 for 25, dark 8 for 79 and 9 for 37.
- **Because** the digest ships in every stored document as `PaletteEngine.obligations`, and its
  stated job is to move when the *rules* change. Taken over the row it also moves when the wording
  changes, so a typo fix asserts to every existing document that the rules it was derived under no
  longer hold. A correction that cannot be made is worse than the error it cannot fix.
- **Reversed by** the thresholds moving into fields on `Obligation`. Today they are named
  constants — `DISTINCT`, `INTERCHANGEABLE` and `PERCEPTIBLE` in `ramp.ts`, `CONTRAST_MIN` and
  `BAND` declared in `palette-check.ts` and imported by it — which the digest deliberately does
  not cover, so narrowing it to `{ step, id }` loses nothing the design claims. If a threshold ever
  becomes a field on the row, it belongs in the digest and this record is re-argued.
- **Held by** `packages/palette/src/palette-document.ts`, `hashObligations` and the
  `PaletteEngine.obligations` doc comment, which already states the intent the implementation misses;
  `packages/palette/src/ramp.ts`, `Ramp.boundary`, which records the constraint at the site of the
  measurement it prevents correcting

The subtle part, and the reason this is a record rather than a line in `CONVENTIONS.md`: the usual
advice for a stale number — *fix it* — is actively wrong here, and nothing at the edit site says so.
The person who finds the stale tally is not the person who knows it feeds a digest.

There is one thing the change gives up, and it should be given up knowingly. Today, editing a
threshold constant *and* updating the prose to match moves the hash; under `{ step, id }` it would
not. That coupling is accidental rather than designed — the digest is taken over `OBLIGATIONS` and
not over `ramp.ts` on purpose, so a threshold change already fails to move it whenever the prose is
left alone. The change removes an unreliable signal, not a working one.
