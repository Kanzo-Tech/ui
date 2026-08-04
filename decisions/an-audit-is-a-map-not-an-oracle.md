# An audit is a map, not an oracle

- **Status** live — 2026-07-22
- **Decided** Verify every audit finding against the code before acting on it, including findings
  in this directory and including your own. **Audit a commit, never a working tree**, and say which
  commit in the report's first line.
- **Because** findings of the first architecture audit did not survive contact with the code — the
  status-token rename was applied and fully reverted, the "dead" `Appearance` type was live and
  load-bearing, and a migration step broke at runtime when applied literally. Every later round has
  had to correct its own premises, and independent recounts of the export surface disagreed with
  each other.
- **Reversed by** nothing. Each round of auditing has produced its own falsified findings; the
  rule has never had a counter-example.
- **Held by** `.planning/audit-2026-07-30/README.md`, the "Corrections to the audit's own
  premises" section; `.planning/audit-2026-07-30/handoff-comments.md`, "Rejected findings";
  `packages/theme/src/index.ts`, `Appearance` — the type an audit called dead, still exported and
  still load-bearing

**The sharpest instance is a failure mode of its own, and it is the reason the commit clause is
here.** The comments audit was run against another session's uncommitted working tree rather than
against a commit, so several of its findings quote strings that exist nowhere on this branch — a
ramp count, a test fixture, a whole file. Those findings were not stale; they were **measuring a
different tree**, and no amount of care in the reading would have caught it, because the text they
cite is real somewhere. A report that names its commit is falsifiable by anyone; one that does not
cannot be checked at all.

The corollary for a reviewer: when a finding cites a string you cannot find, the first hypothesis
is not that the finding is wrong. It is that you and the auditor are looking at different trees.
