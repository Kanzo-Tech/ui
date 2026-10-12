import type { Engine, JoinGraph, Selection } from "@kanzo-tech/mosaic";
import { checkAnswer, placed, relationByKey, type AnswerRelation } from "../data/answer.js";
import { readAnswer, type AnswerOutput } from "../data/read.js";

/** What an answer the page wrote reads: checked against `relations`, placed, and read on `engine`. */
export async function readFor(
  engine: Pick<Engine, "query">,
  graph: JoinGraph,
  relations: readonly AnswerRelation[],
  input: unknown,
  selection?: Selection,
): Promise<AnswerOutput> {
  const checked = checkAnswer(input, relations, graph);
  if (!checked.success) throw checked.error;
  const about = relationByKey(graph, relations, checked.value.relation)!;
  return readAnswer(placed(checked.value, "c", about.relation), about, { engine, graph, selection });
}
