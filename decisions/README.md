# Decisions

Architecture decision records for `kanzo-ui`.

`DESIGN.md` holds the **rules** — what may enter the library, how a component is
assembled, which layer decides what. These hold the **decisions**: dated, with the
alternatives that lost and the consequences we accepted.

The distinction matters when they disagree. A rule that keeps being argued with is
a rule due for revision; an ADR that contradicts `DESIGN.md` should say so in its
own Context and either change the rule or explain why it is an exception.

Same format as `rmlext/decisions/`, deliberately: since ADR-0040 the two
repositories reason about each other, and a reader crossing between them should
not have to learn a second shape. Copy `template.md`, number sequentially, and
write it within a day of deciding.
