# One changeset until the first publish

- **Status** live — 2026-07-30
- **Decided** `.changeset/` holds a single changeset describing what the packages are, until
  something is actually published. The accumulated ones were deleted, not archived.
- **Because** they were a work journal wearing release-note clothes: they described an intermediate
  history no consumer ever saw, announced renames to names that were then deleted, and documented
  an API the palette work removed. A changeset says what a *consumer* must do differently; the
  reason a decision was taken belongs in `decisions/`.
- **Reversed by** the first publish. After it there is a released version to describe changes
  against, and the normal one-changeset-per-change rule resumes — that is when a bump level starts
  meaning something, and when a `!` in a commit subject must be a `major`.
- **Held by** `CONVENTIONS.md`, the distribution section; `.changeset/README.md`

**On merge, this needs doing again.** The parallel identity-axis session is carrying its own
changesets in the main checkout, and they will arrive here at integration. They get the same
treatment: fold what a consumer must know into the single changeset, delete the rest. Two of them
litigate the appearance axis against each other and would otherwise ship a changelog that argues
with itself — resolve that before folding, because the collapse would silently pick a winner.
