---
"@kanzo-tech/mosaic": patch
---

`relationQuery` over a type with no hops now reads the type's table under its own name, with
unqualified columns: `SELECT "dense_id", "lat" AS "Airport.lat" FROM "Airport"`, where it used to write
`SELECT "t0"."dense_id" AS "dense_id", "t0"."lat" AS "Airport.lat" FROM "Airport" AS "t0"`. Under the alias, a regression,
correlation or variance tile failed Mosaic's pre-aggregation as soon as another tile was brushed:
`Referenced table "t0" not found`, then `Table with name preagg_… does not exist` on every brush.
Those tiles now pre-aggregate. A relation with a path is unchanged. If you match on the SQL text of a
single-type relation, drop the `"t0".` qualifier and the `AS "t0"`.
