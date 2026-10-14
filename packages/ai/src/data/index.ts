// @kanzo-tech/ai/data — asking questions of data. Ask is a Task (`ask`): the model fills a spec whose
// fields are paths, `JoinResolver` resolves them, the oracles check it; `useAskChat` runs it behind a chat, `askOffers`
// gives the questions to start from as its own checked proposals, and each answer is the dashboard tile
// `AnswerCard` draws, read under the page's chips.
//
// A subpath and not the root barrel because it draws with `@kanzo-tech/ui`'s analytics and table
// layers, whose engines are optional peers: a host that only chats must not install DuckDB and
// TanStack Table to import `Chat`. Nothing here knows what the data is — the join graph and the
// relations offered over it are the host's.

export { askEdit, askOffers, useAskChat } from "./ask-chat.js";
export type { AskChatOptions, AskChatTranslations, AskMessage, AskOutput, AskTurn } from "./ask-chat.js";
export { AskChips } from "./ask-chips.js";
export type { AskChipsProps } from "./ask-chips.js";
export type { AnswerOutput, QueryRow } from "./read.js";
export { ask } from "./ask.js";
export type { AskChip, AskContext, AskInput, AskSpec } from "./ask.js";
export type { Answer, AnswerField, AnswerRelation, UnansweredClause } from "./answer.js";
export { answerRelationsOf, readAnswerRelations } from "./relations.js";
export type { AnswerRelationsOfOptions, ReadAnswerRelationsOptions } from "./relations.js";
export { AnswerCard } from "./answer-card.js";
export type { AnswerAdded, AnswerCardProps, AnswerCardTranslations } from "./answer-card.js";
