"use client";

import { useMemo } from "react";
import { useKanzoTheme } from "@kanzo-tech/ui";
import { lookFrom, presetOf, type Look, type LookPreset } from "../render/graph-looks";
import { simFrom, type Sim } from "../render/graph-sim";
import { GRAPH_SECTION } from "../section";

/**
 * The graph section's resolved preferences, as the two objects `useGraph` takes.
 *
 * The join between the provider's `sectionPrefs` and the two readers of this package's manifest.
 * Every host that drew a graph under a preferences panel wrote it — the docs' workspace and keasy's
 * discover page, the same eight lines each — and it knows nothing a host decides: the namespace,
 * the keys, the defaults and the bounds are all `GRAPH_SECTION`'s, and the resolution chain is the
 * provider's. What reaches `lookFrom`/`simFrom` is the resolved value, never the stored one.
 *
 * `preset` is the named look the axes are, for a host that pairs channels with it — Ink spends
 * identity on shape — and `null` once a reader has customised past all three.
 *
 * Needs `KanzoThemeProvider` with `GRAPH_SECTION` among its `sections`. Without it the namespace
 * resolves to nothing, both objects are the manifest's defaults and the preset is Atlas.
 */
export function useGraphPrefs(): { look: Look; sim: Sim; preset: LookPreset | null } {
  const resolved = useKanzoTheme().sectionPrefs[GRAPH_SECTION.namespace];

  return useMemo(() => {
    const values = Object.fromEntries(
      Object.entries(resolved ?? {}).map(([key, pref]) => [key, pref.value]),
    );
    return { look: lookFrom(values), sim: simFrom(values), preset: presetOf(values) };
  }, [resolved]);
}
