"use client";

import * as React from "react";
import type { PrefOption, PrefSources } from "@kanzo-tech/theme";

/** A picture for one option of a choice, drawn above its name. A manifest is data and cannot hold one. */
export type PrefSpecimen = (option: PrefOption) => React.ReactNode;

/** What a section's owner knows that its manifest cannot say, keyed by the section's own names. */
interface Contribution {
  sources: PrefSources;
  specimens: Readonly<Record<string, PrefSpecimen>>;
}

const SectionContext = React.createContext<ReadonlyMap<string, Contribution>>(new Map());
SectionContext.displayName = "KanzoSectionContext";

export interface SectionProviderProps {
  /** The section this speaks for — `"graph"`, or `"theme"` for the core. */
  namespace: string;
  /** The lists a declaration names with `{ from }`, answered by whoever holds them. */
  sources?: PrefSources;
  /** A picture per option, keyed by preference: what a generic control cannot draw. */
  specimens?: Readonly<Record<string, PrefSpecimen>>;
  children?: React.ReactNode;
}

const NONE = {};

/**
 * **What only a section's owner knows, for the subtree beneath it** — the lists its choices name
 * and the pictures its options wear.
 *
 * React context for what a whole subtree shares, the way the theme already reaches every part and
 * Ark's `EnvironmentProvider` and `LocaleProvider` do: a manifest says WHAT may be set, and the
 * owner says, from where it stands, what it alone can answer. The theme provider is the core's —
 * it answers `"themes"` from what the tenant published — and the graph's root is the graph's, with
 * the columns of the corpus it attached. So a `<Pref>` anywhere beneath draws the whole control and
 * no host passes a list it does not own.
 *
 * **It merges over the one above**, per namespace, as a nested `ThemeProvider` does in MUI: an
 * owner adds to what an outer one said rather than erasing it. Outside every owner, a source is
 * unanswered — `prefOptions` says `null` — and the control it fills is not drawn, which is what a
 * tenant who published no themes already gets.
 */
export function SectionProvider({ namespace, sources = NONE, specimens = NONE, children }: SectionProviderProps) {
  const outer = React.useContext(SectionContext);
  const value = React.useMemo(() => {
    const before = outer.get(namespace);
    const next = new Map(outer);
    next.set(namespace, {
      sources: { ...before?.sources, ...sources },
      specimens: { ...before?.specimens, ...specimens },
    });
    return next;
  }, [outer, namespace, sources, specimens]);
  return <SectionContext.Provider value={value}>{children}</SectionContext.Provider>;
}

const EMPTY: Contribution = { sources: {}, specimens: {} };

/** What the nearest owners said about one section. Empty outside every owner. */
export function useSectionContribution(namespace: string): Contribution {
  return React.useContext(SectionContext).get(namespace) ?? EMPTY;
}
