---
"@kanzo-tech/graph": patch
---

A corpus of more than 16,777,216 vertices (2²⁴) is now refused with a `graph/too-large` problem, which
carries `count` and `limit`, instead of being drawn wrong. A vertex id is held as a `Float32` in the
links and rounds past that number, so a link attached to a neighbouring vertex and nothing said so. The
refusal comes from the catalog's counts, before one link is read; `retry` cannot clear it, only a
smaller corpus can.
