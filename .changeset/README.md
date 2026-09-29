# Changesets

This folder holds [changesets](https://github.com/changesets/changesets), and a changeset here is
**release notes waiting for a release**, nothing else. `pnpm changeset` records one for the packages
you touched.

The git tag decides the version (`.github/workflows/release.yml`), so `changeset version` is never
run and no `CHANGELOG.md` is kept. When a release is published, its notes are written from the
changesets in this folder onto the GitHub Release, and those changesets are deleted in the same
change. A changeset present here is therefore one no release has shipped yet.

A changeset addresses a **consumer**: what changed for them, and what to edit if it breaks them. The
reason a decision was taken goes on `/docs/design`, not here.
