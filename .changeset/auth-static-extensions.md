---
"@kanzo-tech/auth": minor
---

**Breaking.** The proxy no longer treats every path with a dot in its last segment as a static file.
It lets through without a session only a path ending in an extension on the new `staticExtensions`
option, whose default is what a browser fetches to draw a page: `js`, `mjs`, `css`, `map`, `wasm`,
`png`, `jpg`, `jpeg`, `gif`, `webp`, `avif`, `svg`, `ico`, `woff`, `woff2`, `txt`, `xml`,
`webmanifest`. `/graphs/foo.bar` or a dataset slug `x.csv` is now a page and is gated; a data format
is deliberately not on the list. Narrow your `proxy.ts` `matcher` so it does not exclude `.*\..*`
(`/((?!_next/static|_next/image|favicon.ico).*)`), list an asset extension the default lacks in
`staticExtensions` (it replaces the default), and list a path that must open without a session under
`public`.
