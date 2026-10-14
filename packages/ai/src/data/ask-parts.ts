import type { Relation } from "@kanzo-tech/mosaic";
import { parseTile } from "@kanzo-tech/ui/analytics";
import type { Decision } from "../task/index.js";
import type { AnswerOutput, QueryRow } from "./read.js";
import { askTile, type AskSpec } from "./ask.js";
import type { AskOutput, AskTurn } from "./ask-chat.js";

/**
 * **What a kept Ask chat is read back through** — the schemas of its two data parts, `answer` and
 * `ask`, as Standard Schema, which `validateUIMessages` takes. Each part is rebuilt from the fields
 * it may hold and nothing else, and its tile is checked by `parseTile`, the dashboard's own reading
 * of a stored tile: a restored answer is names over the host's graph, never a statement, and a field
 * added to a part elsewhere does not ride along unread.
 */

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

/** Thrown at the first field that is not what a part holds; the AI SDK names the part around it. */
function refuse(at: string, expected: string): never {
  throw new Error(`not an Ask part at ${at}: expected ${expected}`);
}

const strings = (value: unknown, at: string): string[] =>
  Array.isArray(value) && value.every(isString) ? [...value] : refuse(at, "a list of strings");

function relation(value: unknown, at: string): Relation {
  if (!isObject(value) || !isString(value.root) || !Array.isArray(value.path)) return refuse(at, "a relation, { root, path }");
  const path = value.path.map((hop: unknown, i): Relation["path"][number] =>
    isObject(hop) && isString(hop.edge) && (hop.direction === "out" || hop.direction === "in")
      ? { edge: hop.edge, direction: hop.direction }
      : refuse(`${at}.path.${i}`, "a hop, { edge, direction }"),
  );
  return { root: value.root, path };
}

function spec(value: unknown, at: string): AskSpec {
  if (!isObject(value) || !isString(value.of)) return refuse(at, "a spec, { of, show }");
  const read = { of: value.of, show: value.show, where: value.where, top: value.top } as AskSpec;
  // The spec is a tile less its id; the dashboard's reading of a tile is its check.
  const tile = parseTile(askTile(read, "answer"));
  const show: Json = { ...tile };
  for (const key of ["id", "span", "origin", "where", "top"]) delete show[key];
  return {
    of: value.of,
    show: show as unknown as AskSpec["show"],
    ...(tile.where === undefined ? {} : { where: tile.where }),
    ...("top" in tile && tile.top !== undefined ? { top: tile.top } : {}),
  };
}

function decision(value: unknown, at: string): Decision {
  if (!isObject(value) || !isString(value.id) || !isString(value.question) || !Array.isArray(value.options)) {
    return refuse(at, "a decision, { id, question, options }");
  }
  const options = value.options.map((o, i) =>
    isObject(o) && isString(o.id) && isString(o.label)
      ? { id: o.id, label: o.label, ...(isString(o.detail) ? { detail: o.detail } : {}) }
      : refuse(`${at}.options.${i}`, "an option, { id, label }"),
  );
  return { id: value.id, question: value.question, options };
}

/** An `ask` part: the turn's spec, the decision it asks, and the options picked by decision id. */
function askTurn(value: unknown): AskTurn {
  if (!isObject(value)) return refuse("", "a turn, { spec }");
  const decided = value.decided;
  if (decided !== undefined && !(isObject(decided) && Object.values(decided).every(isString))) refuse("decided", "options by decision id");
  return {
    spec: spec(value.spec, "spec"),
    ...(value.decision === undefined ? {} : { decision: decision(value.decision, "decision") }),
    ...(decided === undefined ? {} : { decided: { ...(decided as Record<string, string>) } }),
  };
}

/** An `answer` part: the answer, its read when it was read, and the spec it was read from. */
function answerPart(value: unknown): AskOutput {
  if (!isObject(value) || !isObject(value.answer)) return refuse("", "an answer, { answer, spec }");
  const { rows, truncated, under, unanswered } = value;
  if (rows !== undefined && !(Array.isArray(rows) && rows.every(isObject))) refuse("rows", "a list of rows");
  if (truncated !== undefined && typeof truncated !== "boolean") refuse("truncated", "a boolean");
  const output: AnswerOutput = {
    answer: { relation: relation(value.answer.relation, "answer.relation"), tile: parseTile(value.answer.tile) },
    ...(rows === undefined ? {} : { rows: (rows as QueryRow[]).map((row) => ({ ...row })) }),
    ...(truncated === undefined ? {} : { truncated }),
    ...(under === undefined ? {} : { under: strings(under, "under") }),
    ...(unanswered === undefined
      ? {}
      : {
          unanswered: Array.isArray(unanswered)
            ? unanswered.map((u, i) =>
                isObject(u) && isString(u.clause) ? { clause: u.clause, missing: strings(u.missing, `unanswered.${i}.missing`) } : refuse(`unanswered.${i}`, "{ clause, missing }"),
              )
            : refuse("unanswered", "a list"),
        }),
  };
  return { ...output, spec: spec(value.spec, "spec") };
}

/** A parse that throws, as Standard Schema: what `validateUIMessages` and `useChat` take. */
const standard = <T>(parse: (value: unknown) => T) => ({
  "~standard": {
    version: 1 as const,
    vendor: "kanzo",
    validate: (value: unknown) => {
      try {
        return { value: parse(value) };
      } catch (error) {
        return { issues: [{ message: (error as Error).message }] };
      }
    },
  },
});

/** Ask's data parts' schemas: a kept chat is read back through them, and every part Ask streams. */
export const ASK_PARTS = { ask: standard(askTurn), answer: standard(answerPart) };
