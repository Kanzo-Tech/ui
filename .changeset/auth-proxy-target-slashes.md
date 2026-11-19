---
"@kanzo-tech/auth": patch
---

`kanzoAuth().api` now strips every trailing slash from an API's `target` before joining the request's
path to it, as it already did for the issuer and the mount. A target written `https://reports.internal/v1//`
forwarded to `/v1//reports/7` and now forwards to `/v1/reports/7`.
