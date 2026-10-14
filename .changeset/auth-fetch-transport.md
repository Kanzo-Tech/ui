---
"@kanzo-tech/auth": minor
---

`bffAuth` bounds the two requests it makes itself, `/session` and `/refresh`, and no other. **Breaking:** do not wrap the `fetch` you pass `bffAuth` in a deadline — it is the transport for the session read too, and two deadlines race to name one failure; bound your API calls with a signal on each request (`AbortSignal.timeout(30_000)`) instead.
