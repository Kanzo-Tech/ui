---
"@kanzo-tech/auth": minor
---

The forwarder (`auth.api`) now ends a hop that never answers. It passes the upstream request the
client's own signal, so a person who navigates away cancels it, and it gives the API 25 seconds to
send its response headers (a stream that is alive after them is not ended). An API that connects and
says nothing answers a 504 problem with the new code `api/silent` and `data.after`; add it to your
error registry beside `api/unreachable`.

