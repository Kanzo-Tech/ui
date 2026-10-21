// @kanzo-tech/ai/data — asking questions of data. Ask is a Task (`ask`): the model fills a spec — a
// pattern of the graph and a tile on it — the graph's `match` and the oracles check it; `useAskChat` runs it behind a chat, `askOffers`
// gives the questions to start from as its own checked proposals, and each answer is the dashboard tile
// `AnswerCard` draws, read under the page's chips.
//
// A subpath and not the root barrel because it draws with `@kanzo-tech/ui`'s analytics and table
// layers, whose engines are optional peers: a host that only chats must not install DuckDB and
// TanStack Table to import `Chat`. Nothing here knows what the data is — the `Graph` is the host's,
// and what each type and property is and holds is asked of it, never read off a format.

export { askEdit, askKeep, askOffers, useAskChat } from "./ask-chat.js";
export type { AskChatOptions, AskChatTranslations, AskMessage, AskOutput, AskTurn } from "./ask-chat.js";
export { AskChips } from "./ask-chips.js";
export type { AskChipsProps } from "./ask-chips.js";
export type { AnswerOutput, QueryRow } from "./read.js";
export { ask } from "./ask.js";
export type { AskChip, AskContext, AskInput, AskSpec } from "./ask.js";
export type { Answer, AnswerRelation, UnansweredClause } from "./answer.js";
export { AnswerCard } from "./answer-card.js";
export type { AnswerAdded, AnswerCardProps, AnswerCardTranslations } from "./answer-card.js";
