---
"@kanzo-tech/ai": minor
---

**`@kanzo-tech/ai/data`: the model's SQL goes through a statement gate, and `QueryResult` never runs a transcript's SQL.**

- `gateStatement(coordinator, sql, { tables, scope, limit })` is new, and `dataAgent` calls it before
  every query. It lets through exactly one SELECT that reads the schema's tables, `scope` and its own
  CTEs, and answers anything else as a refusal the model reads: a second statement, DDL, `COPY`,
  `ATTACH`, `SET`, `PRAGMA`, a table function (`read_csv`, `read_text`, `glob`, …), `DESCRIBE`, a file
  or URL named as a table, a table the schema does not declare, or a CTE named `scope`. What runs is
  DuckDB's own print of the parsed statement, under the cap and the scope.
- **Breaking:** `describeSchema` answers a `DataSchema`, `{ ddl, tables }`, and `dataAgent`'s and
  `dataSuggestions`' `schema` take it. Pass `describeSchema`'s answer as it is; where you read the DDL
  string, read `schema.ddl`.
- **Breaking:** `QueryOutput` no longer carries `statement`. `QueryResult` draws its chart from the
  answer's `rows`, so restoring a conversation runs nothing.
- `truncated` is now true only when the cap cut the answer short, not when it fitted exactly.
