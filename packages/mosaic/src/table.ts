import type { ExprNode } from "@uwdata/mosaic-sql";

/**
 * A relation, read the way mosaic-sql's `Query.from` and vgplot's `from` read one. A string is ONE
 * identifier in the default catalog: `"Person"` is `FROM "Person"`, and a dot inside it is part of
 * the name, never a path. A node is SQL as written: `asTableRef(["jobs/7", "Person"])` for a path
 * held in parts, `verbatim(sql)` for a name a backend hands over already quoted — a fossil corpus's
 * `relation.sql`.
 */
export type TableExpr = string | ExprNode;
