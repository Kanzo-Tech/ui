// Moved into @kanzo-tech/graph, which needed it to load a relation without joining the crossfilter.
//
// It is arguably not a graph concern at all — "one unfiltered read as a throwaway `MosaicClient`"
// is the same shape of helper `arrow.ts` turned out to be, and that one ended up in
// `@kanzo-tech/ui/analytics`. Left here as a re-export rather than promoted twice in one change:
// three call sites clear the admission rules, so this is a candidate, not a conclusion.
export { onceQuery } from "@kanzo-tech/graph";
