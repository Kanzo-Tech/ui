// @kanzo-tech/ai/data — asking questions of data. An agent that answers with a dashboard tile over a
// relation (`dataAgent`), the schema whose every name the page generated (`answerSchema`), the
// relations it may answer about (`answerRelationsOf`, `readAnswerRelations`), the questions to start from
// (`dataSuggestions`), and the card each answer is drawn in (`AnswerCard`).
//
// A subpath and not the root barrel because it draws with `@kanzo-tech/ui`'s analytics and table
// layers, whose engines are optional peers: a host that only chats must not install DuckDB and
// TanStack Table to import `Chat`. Nothing here knows what the data is — the join graph and the
// relations offered over it are the host's.

export { dataAgent, dataInstructions, dataSuggestions } from "./agent.js";
export type { AnswerOutput, DataAgentOptions, DataSuggestionsOptions, DataTools, QueryRow } from "./agent.js";
export { answerSchema, checkAnswer } from "./answer.js";
export type { Answer, AnswerField, AnswerInput, AnswerRelation, Condition, ConditionValue, SkippedClause } from "./answer.js";
export { answerRelationsOf, readAnswerRelations } from "./relations.js";
export type { AnswerRelationsOfOptions, ReadAnswerRelationsOptions } from "./relations.js";
export { AnswerCard } from "./answer-card.js";
export type { AnswerAdded, AnswerCardProps, AnswerCardTranslations } from "./answer-card.js";
