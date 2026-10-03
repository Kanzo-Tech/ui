// @kanzo-tech/ai/data — asking questions of data. An agent that answers by querying DuckDB on the
// page's coordinator (`dataAgent`), the schema it is given (`describeSchema`), the questions to start
// from (`dataSuggestions`), and the card each answer is drawn in (`QueryResult`).
//
// A subpath and not the root barrel because it draws with `@kanzo-tech/ui`'s analytics, table and
// editor layers, whose engines are optional peers: a host that only chats must not install DuckDB,
// TanStack Table and CodeMirror to import `Chat`. Nothing here knows what the data is — what a host
// knows that DuckDB's catalog does not comes in as references and a key.

export { dataAgent, dataInstructions, dataSuggestions } from "./agent.js";
export type {
  DataAgentOptions,
  DataScope,
  DataSuggestionsOptions,
  DataTools,
  QueryAnswer,
  QueryOutput,
  QueryRefusal,
  QueryRow,
} from "./agent.js";
export { describeSchema } from "./schema.js";
export type { DescribeSchemaOptions, SchemaReference } from "./schema.js";
export { QueryResult } from "./query-result.js";
export type { QueryResultProps, QueryResultTranslations } from "./query-result.js";
