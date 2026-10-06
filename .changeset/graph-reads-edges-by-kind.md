---
"@kanzo-tech/graph": patch
---

The graph draws links from a corpus's edge tables only. A table of another kind, such as the table a
multi-valued property is written to, is no longer read as a relation, so it no longer breaks the
layout or the neighbour counts.
