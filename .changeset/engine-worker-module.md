---
"@kanzo-tech/mosaic": patch
---

`engine()` boots under `next dev` when your app transpiles `@kanzo-tech/mosaic`. Its worker died with
`Cannot use 'import.meta' outside a module`, because the footer React Refresh adds to the worker's
file is module syntax and the worker was started as a classic script; it is now started as a module
worker (`new Worker(url, { type: "module" })`), which every current browser supports. Production
builds already worked and behave as before.
