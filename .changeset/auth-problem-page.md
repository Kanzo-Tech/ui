---
"@kanzo-tech/auth": minor
---

**A failed sign-in, callback or sign-out redirects to your problem page instead of answering JSON.**
`authRoutes`' `/signin`, `/callback` and `/signout` answer an `AuthError` with a 302 to
`problemPage` — a new option, default `/auth/problem` — carrying the code:
`/auth/problem?code=callback%2Fstate-mismatch`. They used to answer a 400 JSON body (and `/signout`
a bare 500), which the person read in the address bar. Add a page at that path that renders the
`code` query parameter. `authMiddleware` keeps the same path public by default and takes the same
`problemPage` option: if you move the page, pass the new path to both, or a failed sign-in loops
back into signing in. A failure that is not an `AuthError` is still thrown to Next.
