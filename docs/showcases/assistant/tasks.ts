import { defineTask, type Finding } from "@kanzo-tech/ai/task";
import { jsonSchema } from "@kanzo-tech/llm";
import { mockModel, promptOf } from "@/lib/mock-model";
import { CONCEPTS, say } from "./data";

/** A competency question, and what in the data it stands on. */
export interface Question {
  question: string;
  uses: string[];
}

export interface QuestionsInput {
  /** What the data is about, in the person's sentence. */
  domain: string;
}

/**
 * The one oracle: a question is kept only when everything it stands on is in the files. The schema
 * already makes `uses` an enum of `CONCEPTS`, so a model held to it cannot name anything else — a
 * model that is not held (or a question the person typed) can, and this is what says so.
 */
const answerable = (value: Question): Finding[] => [
  ...(value.uses.length === 0 ? [{ code: "question/grounded", message: "It does not say what in the data answers it." }] : []),
  ...value.uses
    .filter((concept) => !CONCEPTS.includes(concept))
    .map((concept) => ({
      code: "question/answerable",
      message: `No file holds the ${concept.split(".").at(-1)}: nothing in your data can answer it.`,
      at: "/uses",
    })),
];

const schema = jsonSchema<Question>({
  type: "object",
  properties: {
    question: { type: "string" },
    uses: { type: "array", items: { type: "string", enum: CONCEPTS }, minItems: 1 },
  },
  required: ["question", "uses"],
  additionalProperties: false,
});

/**
 * The requirements Task: questions the graph should answer, each grounded in the files. Proposed
 * as a list (`useTask`), and a question the person writes goes through the same Task, so it is
 * grounded and checked the same way.
 */
export const questions = defineTask<QuestionsInput, Question>({
  name: "requirements",
  instructions:
    "Propose questions someone would ask of this data. Each names, in `uses`, the columns and links that answer it, from the list given and nothing else.",
  prompt: (input) => `The data is about: ${input.domain}\nWhat a question may use: ${CONCEPTS.join(", ")}`,
  output: () => schema,
  verify: [answerable],
  attempts: 1,
});

/** A question the person wrote, grounded by the model and judged by the same oracle. */
export const grounding = defineTask<{ question: string }, Question>({
  name: "requirements.ground",
  instructions: "Say, in `uses`, which columns and links answer this question, from the list given and nothing else.",
  prompt: (input) => `Ground this question: ${input.question}\nWhat a question may use: ${CONCEPTS.join(", ")}`,
  output: () => schema,
  verify: [answerable],
  attempts: 1,
});

/** What the mock model proposes. One of them asks for money the files do not hold: the oracle drops it. */
const OFFERED: Question[] = [
  { question: "Which institutions have the most Physics prizes?", uses: ["Award→Institution", "Award.category"] },
  { question: "How many women have won a prize in each category?", uses: ["Award→Laureate", "Laureate.gender", "Award.category"] },
  { question: "How much prize money did each laureate receive?", uses: ["Award→Laureate", "Award.amount"] },
  { question: "In which countries were the most laureates born?", uses: ["Laureate.country"] },
  { question: "Which laureates won more than one prize?", uses: ["Award→Laureate"] },
];

/** A typed question, grounded by keyword the way a small model would by reading: a stand-in, not a parser. */
const CUES: [RegExp, string][] = [
  [/\b(money|amount|paid|dollars?|kronor)\b/i, "Award.amount"],
  [/\b(institution|universit|affiliat)/i, "Award→Institution"],
  [/\b(laureate|women|men|who|winner)/i, "Award→Laureate"],
  [/\b(women|men|gender)\b/i, "Laureate.gender"],
  [/\b(born|birth|age)\b/i, "Laureate.born"],
  [/\b(country|countries|nation)/i, "Laureate.country"],
  [/\b(categor|physics|chemistry|peace|literature|medicine|economics)/i, "Award.category"],
  [/\b(year|when|decade)\b/i, "Award.year"],
  [/\b(why|for what|motivation|awarded for)\b/i, "Award.motivation"],
  [/\b(city|cities)\b/i, "Institution.city"],
];

export function ground(question: string): Question {
  const uses = [...new Set(CUES.filter(([cue]) => cue.test(question)).map(([, concept]) => concept))];
  return { question, uses };
}

export const model = mockModel((call) => {
  const prompt = promptOf(call);
  const typed = prompt.match(/^Ground this question: (.*)$/m)?.[1];
  if (typed) return JSON.stringify(ground(typed));
  return JSON.stringify({ elements: OFFERED });
});

/** The concepts a question stands on, in the person's words. */
export const grounds = (q: Question) => q.uses.map(say).join(", ");
