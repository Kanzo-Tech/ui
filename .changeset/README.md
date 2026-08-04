# Changesets

This folder holds [changesets](https://github.com/changesets/changesets). Run
`pnpm changeset` to record a version bump for the packages you touched; CI turns
accumulated changesets into version bumps + npm publishes (see
`.github/workflows/release.yml`).

**Until the first publish there is one changeset, and it describes what the
packages are.** Nothing has ever been released, so a note about what changed has
no released version to change *from*. Fold anything a consumer must know into
`the-first-release.md` and delete the rest — including any changesets that
arrive on a merge from another branch. The reasoning, and what reverses it, is
in `decisions/one-changeset-until-the-first-publish.md`.

A changeset addresses a **consumer**. The reason a decision was taken goes in
`decisions/`, not here — that split is why the last set of these grew to a
thousand-odd lines of design prose and three dead component names.
