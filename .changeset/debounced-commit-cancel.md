---
"@kanzo-tech/ui": minor
---

**`useDebouncedCommit` answers `cancel()`.** It drops a pending edit without committing it, and the
control keeps showing what was typed until the owner's value changes. For an owner whose own write
supersedes the draft — a save that replaces the field being typed in — cancel and then write once,
instead of `flush()` and a second write whose result rests on the two landing in order.
