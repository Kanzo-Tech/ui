# An audit is a map, not an oracle

- **Status** live — 2026-07-22
- **Decided** Verify every audit finding against the code before acting on it, including findings
  in this directory and including your own.
- **Because** three findings of the first architecture audit did not survive contact with the
  code: the status-token rename (applied and fully reverted), the "dead" `Appearance` type (live,
  and load-bearing in the provider), and a migration step that broke at runtime when applied
  literally. The audits of 2026-07-30 then corrected four of their own premises, and three
  independent recounts of the export surface produced three different answers.
- **Reversed by** nothing. Each round of auditing has produced its own falsified findings; the
  rule has never had a counter-example.
- **Held by** `.planning/audit-2026-07-30/README.md`, the "Corrections to the audit's own
  premises" section; `packages/theme/src/index.ts`, `AppearancePref`
