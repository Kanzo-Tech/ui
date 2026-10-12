// @kanzo-tech/ai/data — asking questions of data. Ask is a Task (`ask`): the model fills a spec, the
// resolver finds its relation, the oracles check it; `useAskChat` runs it behind a chat, `askOffers`
// gives the questions to start from as its own checked proposals, and each answer is the dashboard tile
// `AnswerCard` draws, read by `readAnswer` under the page's chips.
//
// A subpath and not the root barrel because it draws with `@kanzo-tech/ui`'s analytics and table
// layers, whose engines are optional peers: a host that only chats must not install DuckDB and
// TanStack Table to import `Chat`. Nothing here knows what the data is — the join graph and the
// relations offered over it are the host's.

export { askOffers, askTransport, questionOf, useAskChat } from "./ask-chat.js";
export type { AskChatOptions, AskMessage, AskTurn } from "./ask-chat.js";
export { readAnswer } from "./read.js";
export type { AnswerOutput, QueryRow } from "./read.js";
export { ask, askAnswer, askRelation, link } from "./ask.js";
export type { AskContext, AskInput, AskSpec } from "./ask.js";
export { answerSchema, checkAnswer } from "./answer.js";
export type { Answer, AnswerField, AnswerInput, AnswerRelation, Condition, ConditionValue, UnansweredClause } from "./answer.js";
export { answerRelationsOf, readAnswerRelations } from "./relations.js";
export type { AnswerRelationsOfOptions, ReadAnswerRelationsOptions } from "./relations.js";
export { AnswerCard } from "./answer-card.js";
export type { AnswerAdded, AnswerCardProps, AnswerCardTranslations } from "./answer-card.js";
