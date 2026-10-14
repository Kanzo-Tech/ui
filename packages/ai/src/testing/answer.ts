import type { Engine, JoinGraph, Selection } from "@kanzo-tech/mosaic";
import { answerRelation, askAnswer, type AskInput, type AskSpec } from "../data/ask.js";
import { readAnswer, type AnswerOutput } from "../data/read.js";

/** What a spec the page asked reads: its paths resolved over `graph`, and read on `engine`. */
export async function readFor(
  engine: Pick<Engine, "query">,
  graph: JoinGraph,
  types: AskInput["types"],
  spec: AskSpec,
  selection?: Selection,
): Promise<AnswerOutput> {
  const answer = askAnswer(spec, { graph }, "c");
  if (!answer) throw new Error(`the spec's paths are not the graph's: ${JSON.stringify(spec)}`);
  return readAnswer(answer, answerRelation(answer.relation, { graph, types }), { engine, graph, selection });
}
