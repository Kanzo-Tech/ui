// Moved into the library: `@kanzo-tech/ui/analytics` exports it as `IdSetClient`.
//
// It turned out not to be a cosmos.gl thing at all — the class imports nothing from
// `@cosmos.gl/graph`. What it actually models is a view whose positions live outside the database,
// which can therefore only ever publish an enumerated set of ids. A canvas, a map and an imperative
// widget all reach the crossfilter through exactly that shape, so the name now says what it
// exchanges rather than which renderer it was first written against.
//
// The old name stays as the local alias its call sites already import.
export { IdSetClient, IdSetClient as CosmosClient } from "@kanzo-tech/ui/analytics";
export type { IdSetClientOptions, IdSetClientOptions as CosmosClientOptions } from "@kanzo-tech/ui/analytics";
