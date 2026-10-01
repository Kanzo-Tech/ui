---
"@kanzo-tech/navigation": minor
---

**A guard that fails no longer traps the person on the page.** When `shouldBlockFn` threw or its
promise rejected, the navigation was cancelled and never replayed: the click did nothing, and the
failure surfaced only as an unhandled rejection. Now the navigation goes ahead and `useBlocker`'s new
`onFailure(error: unknown)` receives what was thrown, whole — pass it to your failure view and branch
on `error.code`.
