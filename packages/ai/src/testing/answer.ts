import type { Engine, JoinGraph, Selection } from "@kanzo-tech/mosaic";
import { answerRelation, askAnswer, type AskSpec } from "../data/ask.js";
import { readAnswer, type AnswerOutput } from "../data/read.js";

/** What a spec the page asked reads: its paths resolved over `graph`, and read on `engine`. */
export async function readFor(
  engine: Pick<Engine, "query">,
  graph: JoinGraph,
  spec: AskSpec,
  selection?: Selection,
): Promise<AnswerOutput> {
  const answer = askAnswer(spec, { graph }, "c");
  if (!answer) throw new Error(`the spec's paths are not the graph's: ${JSON.stringify(spec)}`);
  return readAnswer(answer, answerRelation(answer.relation, graph), { engine, graph, selection });
}
