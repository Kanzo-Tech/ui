---
"@kanzo-tech/ui": patch
"@kanzo-tech/ai": patch
"@kanzo-tech/auth": patch
"@kanzo-tech/graph": patch
"@kanzo-tech/navigation": patch
---

**Peer ranges stop at the major we test.** `react` and `react-dom` are `^19.0.0`, `lucide-react`
`^1.0.0`, every `@codemirror/*` `^6.0.0`, `@lezer/highlight` `^1.0.0`, `@tanstack/react-table`
`^8.0.0`, and `next` `^16.0.0` for `@kanzo-tech/auth` and `^15.3.0 || ^16.0.0` for
`@kanzo-tech/navigation`. They were open-ended (`>=19`, `>=1`, `>=6`…), so a future major would have
installed without a word. Nothing changes for a host on today's majors; a host that already runs a
newer major gets a peer warning instead of silence.
