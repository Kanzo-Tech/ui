---
"@kanzo-tech/graph": minor
---

**`corpusReferences` and the `CorpusReference` type are gone.** They described a corpus's joins for
`@kanzo-tech/ai/data`'s `describeSchema`, which v0.34.0 removed, and nothing else read them.

**What to do:** if you followed v0.34.0's Ask migration there is nothing left to edit. If you still
call `corpusReferences`, read the joins from `readJoinGraph(coordinator, from)` instead: each of its
`edges` names its `table`, its `source` and `destination` types, and the `src` and `dst` columns that
hold their keys.
