---
"@kanzo-tech/ui": minor
---

`Link` takes `asChild`, so a router's link can wear its treatment: `<Link asChild><NextLink href="/board">Board</NextLink></Link>` renders one anchor with `Link`'s classes and your link's `href` and handlers. Nothing else changes; `linkVariants` stays off the barrel.
