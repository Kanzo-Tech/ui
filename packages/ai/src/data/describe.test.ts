import { AiError } from "@kanzo-tech/llm";
import type { JoinGraph } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import type { AnswerField, AnswerRelation } from "./answer.js";
import { relationKey, type Relation } from "@kanzo-tech/mosaic";
import { describeData, estimateTokens, fitData, promptBudget, typeFields } from "./describe.js";

// A graph with three types, so a budget has something to choose between. No engine: the fields are
// written out, as `readAnswerRelations` would read them.
const GRAPH: JoinGraph = {
  types: [
    { name: "Person", table: "person", key: "id", columns: ["gender", "age"] },
    { name: "Post", table: "post", key: "id", columns: ["language", "length"] },
    { name: "City", table: "city", key: "id", columns: ["name"] },
  ],
  edges: [
    { name: "knows", label: "knows", source: "Person", destination: "Person", table: "knows", src: "s", dst: "d" },
    { name: "hasCreator", label: "hasCreator", source: "Post", destination: "Person", table: "has_creator", src: "s", dst: "d" },
    { name: "isLocatedIn", label: "isLocatedIn", source: "Person", destination: "City", table: "located", src: "s", dst: "d" },
  ],
};

const category = (name: string, values: string[]): AnswerField => ({ name, kind: "categorical", role: "dimension", values }) as unknown as AnswerField;
const number = (name: string, min: number, max: number): AnswerField => ({ name, kind: "numeric", role: "measure", min, max }) as unknown as AnswerField;

const person = (alias: string, gender = ["female", "male"]) => [category(`${alias}.gender`, gender), number(`${alias}.age`, 18, 90)];
// A post has many measures, so a description that leaves Post out is the smaller by far.
const post = (alias: string) => [
  category(`${alias}.language`, ["en", "es", "zh", "pt", "de", "ru"]),
  number(`${alias}.length`, 0, 2000),
  ...Array.from({ length: 40 }, (_, i) => number(`${alias}.measure${i}`, 0, 100)),
];
const city = (alias: string) => [category(`${alias}.name`, ["Madrid", "Lima", "Delhi", "Osaka", "Lagos", "Quito"])];

const out = (edge: string) => ({ edge, direction: "out" as const });
const into = (edge: string) => ({ edge, direction: "in" as const });
const relation = (root: string, path: { edge: string; direction: "out" | "in" }[], fields: AnswerField[]): AnswerRelation => ({
  relation: { root, path },
  columns: fields.map((f) => f.name),
  fields,
});

const RELATIONS: AnswerRelation[] = [
  relation("Person", [], person("Person")),
  // Over the hop, the second Person's values are those the hop narrows to.
  relation("Person", [out("knows")], [...person("Person"), ...person("Person2", ["male"])]),
  relation("Person", [into("hasCreator")], [...person("Person"), ...post("Post")]),
  relation("Person", [out("isLocatedIn")], [...person("Person"), ...city("City")]),
  relation("Post", [], post("Post")),
  relation("City", [], city("City")),
];

describe("describeData", () => {
  it("names each type once with its own fields, read from the type alone, and each relation by its key", () => {
    const text = describeData(GRAPH, RELATIONS);
    expect(text).toContain("#### Person\n- gender: category (female, male)\n- age: number (18 – 90)");
    expect(text).toContain("#### Post\n- language: category (en, es, zh, pt, de, ru)\n- length: number (0 – 2000)");
    expect(text.match(/- gender:/g)).toHaveLength(1);
    expect(text).toContain(["- Person", "- Person>knows>Person", "- Person<hasCreator<Post", "- Person>isLocatedIn>City", "- Post", "- City"].join("\n"));
    // The numbering is said once, as a rule, not as a field list per relation.
    expect(text).not.toContain("Person2.gender:");
  });

  it("reads a type only a hop reaches from that hop, its numbered alias mapped back to the type", () => {
    const [knows] = [RELATIONS[1]!];
    expect(typeFields(GRAPH, [knows]).map(({ type, fields }) => [type, fields.map((f) => f.column)])).toEqual([["Person", ["gender", "age"]]]);
    const types = typeFields(GRAPH, [RELATIONS[2]!]);
    expect(types.map((t) => t.type)).toEqual(["Person", "Post"]);
  });

  it("names what it leaves out, and a category without its values", () => {
    const text = describeData(GRAPH, RELATIONS.slice(0, 1), { values: false, omitted: ["Post", "City"] });
    expect(text).toContain("- gender: category\n");
    expect(text).toContain("Also in the data, and not described here for room: Post, City.");
  });
});

describe("estimateTokens", () => {
  it("errs long on every prompt measured with the models' own tokenizers", () => {
    // [what, characters, tokens]: Keasy's requests over the dev seeds, counted by Docker Model Runner
    // (`usage.prompt_tokens`, or the refusal's count), 2026-10. `/docs/design/ai-context`.
    const measured: [string, number, number][] = [
      ["e2e corpus, instructions, Qwen3", 4043, 1020],
      ["e2e corpus, the tool, Qwen3", 4918, 1444],
      ["OpenFlights, instructions, Qwen3", 5923, 1718],
      ["OpenFlights, the tool, Qwen3", 7089, 2074],
      ["Nobel, instructions, Qwen3", 6830, 1859],
      ["Nobel, the tool, Qwen3", 6435, 1907],
      ["LDBC SNB, instructions, Qwen3", 34144, 12947],
      ["LDBC SNB, instructions, Hermes 3", 34144, 10739],
      ["LDBC SNB, the tool, Qwen3", 13156, 3597],
      ["CORDIS, instructions, Qwen3", 13248, 4385],
      ["CORDIS, the tool, Qwen3", 11496, 2991],
    ];
    for (const [what, chars, tokens] of measured) expect(estimateTokens("x".repeat(chars)), what).toBeGreaterThanOrEqual(tokens);
  });

  it("keeps a quarter of the window for the answer, at most 2,048", () => {
    expect(promptBudget({ tokens: 4096 })).toBe(3072);
    expect(promptBudget({ tokens: 16384 })).toBe(14336);
    expect(promptBudget({ tokens: 16384, reserve: 6000 })).toBe(10384);
  });
});

describe("fitData", () => {
  const fixed = (text: string) => text;
  const tokens = (text: string) => estimateTokens(text);
  const whole = tokens(describeData(GRAPH, RELATIONS));
  /** What describing only `kept` costs, the rest named as left out. */
  const only = (...kept: AnswerRelation[]) =>
    tokens(describeData(GRAPH, kept, { omitted: RELATIONS.filter((r) => !kept.includes(r)).map((r) => relationKey(GRAPH, r.relation as Relation)) }));
  const lean = tokens(describeData(GRAPH, RELATIONS, { values: false }));

  it("describes every relation, with its values, when they fit", () => {
    const fitted = fitData(GRAPH, RELATIONS, { budget: whole, fixed });
    expect(fitted.shown).toBe(RELATIONS);
    expect(fitted.text).toContain("(female, male)");
  });

  it("drops the values first, keeping every relation", () => {
    const fitted = fitData(GRAPH, RELATIONS, { budget: lean, fixed });
    expect(fitted.shown).toBe(RELATIONS);
    expect(fitted.text).not.toContain("(female, male)");
  });

  it("then keeps the relations the question names, and names the rest as left out", () => {
    const located = RELATIONS[3]!;
    const fitted = fitData(GRAPH, RELATIONS, { budget: only(located), fixed, about: "Which cities are people located in?" });
    // What it names stays; what reaches the costly Post goes, named; what costs a line also stays.
    expect(fitted.shown).toContain(located);
    expect(fitted.shown.some((r) => relationKey(GRAPH, r.relation).includes("Post"))).toBe(false);
    expect(fitted.text).toMatch(/Also in the data, and not described here for room: .*Person<hasCreator<Post/);
  });

  it("with no question, keeps a hop first, as the starters favour", () => {
    const knows = RELATIONS[1]!;
    const fitted = fitData(GRAPH, RELATIONS, { budget: only(knows), fixed, hopsFirst: true });
    expect(fitted.shown).toContain(knows);
    expect(fitted.shown.some((r) => relationKey(GRAPH, r.relation).includes("Post"))).toBe(false);
  });

  it("fails as ai/context when not one relation fits, and sends nothing", () => {
    let failed: unknown;
    try {
      fitData(GRAPH, RELATIONS, { budget: 20, fixed });
    } catch (e) {
      failed = e;
    }
    expect(failed).toBeInstanceOf(AiError);
    expect(failed).toMatchObject({ code: "ai/context", data: { budget: 20 } });
    expect((failed as AiError).data.tokens).toBeGreaterThan(20);
  });
});
