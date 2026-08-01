# Prose that is hashed is data, and a digest takes only the fields it claims

- **Status** open — 2026-07-31. The convention is live; the code change is outstanding.
- **Decided** `hashObligations` should digest each obligation's `{ step, id }`, not the whole row.
  Until it does, the `reason` strings in `OBLIGATIONS` are **data and may not be edited for prose**,
  including to correct a measurement that is known to be wrong.
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
