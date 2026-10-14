---
"@kanzo-tech/ui": minor
---

`valibot` is an optional peer of `@kanzo-tech/ui/analytics` rather than a dependency of `@kanzo-tech/ui`: only the dashboard spec reads it, so an app that never imports `/analytics` no longer installs it.

**Breaking:** install `valibot` if you use `@kanzo-tech/ui/analytics`; `@kanzo-tech/ui` no longer installs it for you.
