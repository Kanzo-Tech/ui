# An audit is a map, not an oracle

- **Status** live — 2026-07-22
- **Decided** Verify every audit finding against the code before acting on it, including findings
  in this directory and including your own.
- **Because** findings of the first architecture audit did not survive contact with the code — the
  status-token rename was applied and fully reverted, the "dead" `Appearance` type was live and
  load-bearing, and a migration step broke at runtime when applied literally. Every later round has
  had to correct its own premises, and independent recounts of the export surface disagreed with
  each other.
- **Reversed by** nothing. Each round of auditing has produced its own falsified findings; the
  rule has never had a counter-example.
- **Held by** `.planning/audit-2026-07-30/README.md`, the "Corrections to the audit's own
  premises" section; `packages/theme/src/index.ts`, `Appearance` — the type an audit called dead,
  still exported and still load-bearing
