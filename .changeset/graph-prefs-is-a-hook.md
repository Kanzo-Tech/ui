---
"@kanzo-tech/graph": minor
---

**`useGraphPrefs()` joins the graph section to the provider, so a host stops writing the join.**

Every host that drew a graph under a preferences panel wrote the same eight lines: read
`useKanzoTheme().sectionPrefs[GRAPH_SECTION.namespace]`, flatten it to values, and hand them to
`lookFrom` and `simFrom`. That is now one call on the root barrel:

```tsx
import { GraphCanvas, useGraphPrefs } from "@kanzo-tech/graph";

const { look, sim } = useGraphPrefs();
<GraphCanvas look={look} sim={sim} source={source} />;
```

It reads what the provider resolved — a tenant's pin wins over the user's stored choice — and keeps
its identity until a preference moves. Register `GRAPH_SECTION` on `KanzoThemeProvider`'s
`sections`; without it both objects are the manifest's defaults. Delete your own copy of the hook.
`lookFrom` and `simFrom` are unchanged, for a host that builds a look from values of its own.
