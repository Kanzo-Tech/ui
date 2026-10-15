---
"@kanzo-tech/auth": minor
---

The forwarder (`auth.api`) now ends a hop that never answers. It passes the upstream request the
client's own signal, so a person who navigates away cancels it, and it gives the API 25 seconds to
send its response headers (a stream that is alive after them is not ended). An API that connects and
says nothing answers a 504 problem with the new code `api/silent` and `data.after`; add it to your
error registry beside `api/unreachable`.

Every other bound is shorter than the 30 s browser deadline it sits inside, so the browser's
`/session` or `/refresh` no longer fires first and names itself: a `ticketStore` command now gives up
after 5 s (`session/silent`, `data.after` is `5000`) and a request to the identity provider after 10 s
(`idp/silent`, `data.after` is `10000`). A store or an IdP that is slow but alive for 5 to 30 s now
fails where it used to answer. The browser's own `/session` and `/refresh` stay at 30 s.
