---
"@kanzo-tech/ai": minor
---

An Ask answer is a relation and a tile — `Answer` is `{ relation, tile }`, the tile holding its own `where` and `top` — and Ask's transport writes it as a `data-answer` part, once as asked and again under the same `id` once read, not as a tool call no model made. `AnswerCard` takes that part's data as `answer` and draws it with the dashboard's `TileView`, so *Add to the dashboard* adds the question whole — *Physics prizes by university*, not *prizes by university*. `Chat` draws data parts through a `data` renderer map beside `tools` (`ChatDataRenderers`), each handed `{ stopped }` once its message is written no more.

**Breaking:** draw answers from `Chat`'s `data` renderers under `answer`, not from `tools.answer`: `data={{ answer: (part, { stopped }) => <AnswerCard answer={part.data as AskOutput} graph={graph} stopped={stopped} /> }}`. `AnswerCard` takes `answer`, not `part`; `AnswerCardTranslations`' `rows` is gone (a table's title is the tile's). `Answer`'s `where`, `show` and `top` are `tile.where`, `tile` and `tile.top`. `AnswerOutput`'s `rows`, `truncated`, `under` and `unanswered` are absent while the answer is read. `answerSchema`, `checkAnswer`, `AnswerInput`, `Condition` and `ConditionValue` are gone from `@kanzo-tech/ai/data`: the spec's schema is Ask's own, and `Condition` is `@kanzo-tech/ui/analytics`'.
