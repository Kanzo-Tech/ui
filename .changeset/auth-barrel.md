---
"@kanzo-tech/auth": minor
---

**Breaking:** `singleFlight` and `readSession` are gone from `@kanzo-tech/auth`; import `claims` and `ClaimsConfig` from `@kanzo-tech/auth/server` instead of the root; `sealedCookie`, `cookieValue`, `SealedCookie`, `SealedCookieConfig`, `rewriteOrigin`, `organizationGroups`, `OrganizationGroups` and `OrganizationGroupsConfig` are gone from `@kanzo-tech/auth/server` — write the admin-API lookup of a group overage with your own service account.
