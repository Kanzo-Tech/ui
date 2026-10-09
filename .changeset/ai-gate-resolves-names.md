---
"@kanzo-tech/ai": patch
---

**The `query` tool's gate runs a table name that can only mean one table, instead of refusing it.**
A model shown qualified names drops the qualifier (`"Person"` for `"jobs/7"."Person"`) or puts it on
`scope` (`"jobs/7"."scope"`), and a small model then answered with "The query failed" rather than
writing the query again. A name now runs as the one table of `tables` it ends in, or as `scope`;
a name two tables end in is still refused, and nothing outside `tables` and `scope` is ever read.
Nothing to edit.
