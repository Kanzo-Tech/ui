import type { Graph } from "@kanzo-tech/graphar-duckdb";
import type { Selection } from "@kanzo-tech/mosaic";
import type { Engine } from "@kanzo-tech/mosaic/engine";
import { answerRelation, askAnswer, type AskSpec } from "../data/ask.js";
import { readAnswer, type AnswerOutput } from "../data/read.js";

/** What a spec the page asked reads: its pattern matched over `graph`, and read on `engine`. */
export async function readFor(engine: Pick<Engine, "query">, graph: Graph, spec: AskSpec, selection?: Selection): Promise<AnswerOutput> {
  const answer = askAnswer(spec, { graph }, "c");
  if (!answer) throw new Error(`the spec's pattern is not the graph's: ${JSON.stringify(spec)}`);
  return readAnswer(answer, answerRelation(answer.pattern, graph), { engine, graph, selection });
}
