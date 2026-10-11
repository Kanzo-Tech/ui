---
"@kanzo-tech/testing": patch
---

**`FilterBarHarness.remove(field)` takes off only the chips of `field`.** Under Playwright it could
press the chip after them — a dashboard's pick, or *Clear every filter* — when the page let the chip
go between the harness reading it and pressing it, as a busy page does: the row moves up, and a
button Playwright finds by its place is the next one by then. It now presses each chip by its name,
once, and waits for it to go before it looks for the next. It also waits for a chip of `field` to
show before it gives up: a chip shows once the page delivers its clause, a while after the brush or
pick. Nothing to change in a suite.
