---
"@kanzo-tech/graph": minor
"@kanzo-tech/ai": minor
---

**A clause a type cannot answer keeps none of that type — on the graph, in its search and in Ask.**
One rule, the one the timeline already followed (`/docs/design/crossfilter#formal-semantics`): a type
answers a clause when it has every column the clause names, and a clause it cannot answer keeps none
of its rows.

- **The graph greys a type that lacks a clause's columns.** Under `score BETWEEN 2 AND 5`, a type
  with no `score` used to stay in full colour; it is now greyed, as a type with no date is under the
  timeline's window. A clause no vertex type can answer keeps nothing, and the whole graph is greyed.
- **`graph/unfilterable` is gone.** Such a clause is no failure: the graph keeps nothing and draws
  it. A host that mapped the code to a message can drop the mapping; `onFailure` never receives it.
- **The search's subset follows the same rule:** a type that cannot answer one of the page's clauses
  is outside the subset, not wholly inside it.
- **Ask reads under every clause.** A page clause its relation cannot answer keeps none of the
  relation's rows: the answer is read under `FALSE`, so a count is 0 and a chart has no bars, as a
  dashboard's tile reads it — it used to skip the clause and read the whole relation.
  - `AnswerOutput.skipped` is `AnswerOutput.unanswered`, `SkippedClause` is `UnansweredClause`.
  - `AnswerCard`'s translation `skipped` is `unanswered`; its English reads *Keeps none of this
    relation's rows, which lack the fields they filter:*.
  - The model is told *Keeps none of this relation's rows, which lack the fields they filter: …* in
    place of *Not applied …*.

**For a host that publishes raw column clauses** straight to the page the graph filters by: a vertex
type without those columns now goes grey under them instead of staying in colour. Publish through a
crossing (`semiJoinOf(key, relation)`) if the clause is meant to reach only one relation's types.

Sizes: graph 24.04 kB (24.1 kB budget), ai/data 8.42 kB (8.5 kB budget); no budget moves.
