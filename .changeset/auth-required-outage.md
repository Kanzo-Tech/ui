---
"@kanzo-tech/auth": minor
---

`auth.session({ required: true })` sends an outage of the session store or the IdP to your `problemPage` with its code, as the proxy does. **Breaking:** delete the `try` that redirected to the problem page around it. `auth.session()` without `required` still throws the `AuthError`.
