"use client";

import { useMemo } from "react";
import { useKanzoTheme } from "@kanzo-tech/ui";
import { placementFrom, type Placement } from "../core/channels";
import { lookFrom, type Look } from "../render/graph-looks";
import { simFrom, type Sim } from "../render/graph-sim";
import { GRAPH_SECTION } from "../section";

/**
 * The graph section's resolved preferences, as the three things `useGraph` takes: the look, the
 * forces, and where the points come from — `{}`, `{ x, y }` or `{ cluster }`, spread on the root.
 *
 * The join between the provider's `sectionPrefs` and the three readers of this package's manifest.
 * Every host that drew a graph under a preferences panel wrote it — the docs' workspace and a host's
 * discover page, the same eight lines each — and it knows nothing a host decides: the namespace,
 * the keys, the defaults and the bounds are all `GRAPH_SECTION`'s, and the resolution chain is the
 * provider's. What reaches `lookFrom`/`simFrom` is the resolved value, never the stored one.
 *
 * Needs `KanzoThemeProvider` with `GRAPH_SECTION` among its `sections`. Without it the namespace
 * resolves to nothing, and all three are the manifest's defaults.
 */
export function useGraphPrefs(): { look: Look; sim: Sim; placement: Placement } {
  const resolved = useKanzoTheme().sectionPrefs[GRAPH_SECTION.namespace];

  return useMemo(() => {
    const values = Object.fromEntries(
      Object.entries(resolved ?? {}).map(([key, pref]) => [key, pref.value]),
    );
    return { look: lookFrom(values), sim: simFrom(values), placement: placementFrom(values) };
  }, [resolved]);
}
