---
"@kanzo-tech/ai": minor
"@kanzo-tech/llm": minor
"@kanzo-tech/mosaic": minor
---

**Ask fits the model's context.** `dataAgent` and `dataSuggestions` describe each type once, with its
fields and values, and each relation in one line, its key, as LangChain's `get_table_info` does. They
used to repeat every type's fields in every relation that reached it. The `answer` tool names its
field list once under `$defs`. Measured with the models' own tokenizers on Keasy's seeds, LDBC SNB's
starters go from 10,466 to 1,290 tokens and its first question on Qwen3 from 16,565 to 3,212. Before,
neither fit an 8K or 16K context. `/docs/design/ai-context` has every graph measured.

**New: `context: { tokens, reserve? }`** on `dataAgent` and `dataSuggestions`, the window the model's
alias was started with. Given it, each call fits: the conversation so far is counted, then the
description narrows if it has to. The category values go first, then the relations the question
names least. The model is told those by name, and the `answer` tool offers only what was described.
When not one relation fits, the call fails as an `AiError` coded **`ai/context`**, with `data.tokens`
and `data.budget`, and nothing is sent. Without `context`, nothing narrows.

**What to change:**

- **Pass each alias's declared context**, the same number the AI services give Model Runner
  (`context_size`, 8,192 in dev and 16,384 for the demo's Qwen3) or a provider's window:
  `dataAgent({ …, context: { tokens: 16384 } })`, `dataSuggestions({ …, context: { tokens: 8192 } })`.
- **`AnswerInput.relation` is the relation's key**, `"Person>knows>Person"`, not the `Relation`
  object. `Answer.relation`, what `AnswerCard`, `onAdd` and a dashboard read, is still the object. A
  test that calls the tool's `execute` directly writes the key, and a scripted model's `answer` call
  writes `relation: "Person"`.
- **Word `ai/context`** in your problem table, beside `ai/unavailable`. For example: *This graph is
  too large to ask about with this model.*
- `answerSchema`'s `relation` is a string enum, and every field slot is `{ "$ref": "#/$defs/field" }`.
  A test that read `relation.properties.root.enum` or a slot's `enum` reads `relation.enum` and
  `$defs.field.enum`.

`@kanzo-tech/mosaic` adds `relationSteps(graph, relation)`, each type a relation reaches with the
alias its columns are prefixed by (`Person`, `Person2`). The `./data` size budget is raised as a
decision, from 7.25 kB to 8.5 kB (7.15 kB measured before this change, 8.39 kB after).
