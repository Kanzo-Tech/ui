---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

**`asc` and `desc` come with the builder.**

`@kanzo-tech/mosaic` and `@kanzo-tech/ui/analytics` both hand you `Query`, and neither handed you
the argument `Query`'s own `.orderby()` takes. A bare column already sorts ascending and there is
no second argument, so any other direction is `desc(col)` and nothing else — which left a host that
had taken everything else from here opening `@uwdata/mosaic-sql` for one function.

```diff
- import { asc, desc } from "@uwdata/mosaic-sql";
- import { Query } from "@kanzo-tech/ui/analytics";
+ import { Query, asc, desc } from "@kanzo-tech/ui/analytics";

  Query.from(table).select({ kind: "kind", n: count() }).groupby("kind").orderby(desc("n"))
```

Both names are on `@kanzo-tech/mosaic` and re-exported from `@kanzo-tech/ui/analytics`, next to the
aggregates, which are complete for the same reason: a vocabulary with a hole in it sends you to
`@uwdata` for the one name we left out, which is the import the barrel exists to remove. Two names
is the whole of ordering, so it is a closed set — mosaic-sql's expression builders are open and
still stay a direct import.

No type comes with them. What `asc` and `desc` take is `ExprValue`, already on both surfaces, and
what they return goes straight into `.orderby()` without you ever naming it.

Nothing is removed and the direct `@uwdata/mosaic-sql` import goes on working — it is a declared
peer either way. One thing to watch when you move an import line across: `column` on these barrels
is ours, the Arrow column reader, not mosaic-sql's column reference of the same name.
