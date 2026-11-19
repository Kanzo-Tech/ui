import { describe, expect, it } from "vitest";
import type { LanguageModel } from "ai";
import { runTask } from "../task/index.js";
import { askOffers } from "./ask-chat.js";
import { ask, askAlternatives, askAnswer, askSchema, askValues, link, type AskInput, type AskSpec } from "./ask.js";
import { NOBEL, answering, asking } from "../testing/nobel.js";

const input = (question: string, extra: Partial<AskInput> = {}): AskInput => ({ question, graph: NOBEL, ...extra });

const award = { as: "award", type: "LaureateAward" } as const;
const university = { as: "university", type: "University" } as const;
const PRIZES_BY_UNIVERSITY = [award, { edge: "university", direction: "out" }, university] as const;
const byUniversity: AskSpec = { match: PRIZES_BY_UNIVERSITY, show: { kind: "chart", type: "bar", x: "university.name", y: { op: "count" } } };

describe("link", () => {
  it("offers the types the question names, and their neighbours", async () => {
    const { types } = await link(input("Which universities won the most prizes?"));
    // In the graph's order: a university's country, the university, its prizes.
    expect(types).toEqual(["Country", "University", "LaureateAward"]);
  });

  it("finds a type by a value the graph answers for it, and keeps what the page's chips are on", async () => {
    const { types, values } = await link(input("And the female ones?", { under: [["Category"]] }));
    expect(values["Laureate.gender"]).toContain("female");
    expect(types).toContain("Laureate");
    expect(types).toContain("Category");
  });

  it("offers every type to a question that names none", async () => {
    expect((await link(input("What is going on?"))).types).toHaveLength(NOBEL.vertexTypes.length);
  });
});

describe("the ask schema", () => {
  it("holds the object at its root, the types and edges in reach as enums, and a field as a variable and a property", async () => {
    // Anthropic's and OpenAI's tool inputs refuse a root `anyOf`: the spec is a property.
    const schema = askSchema(await link(input("Which universities won the most prizes?")), NOBEL) as {
      type: string;
      required: string[];
      properties: { spec: { properties: { match: { items: { anyOf: { properties: Record<string, { enum?: string[] }> }[] } }; where: { items: { anyOf: { properties: { field: { pattern: string } } }[] } } } } };
    };
    expect(schema).toMatchObject({ type: "object", required: ["spec"] });
    const [vertex, edge] = schema.properties.spec.properties.match.items.anyOf;
    expect(vertex!.properties.type!.enum).toEqual(expect.arrayContaining(["LaureateAward", "University", "Country"]));
    expect(edge!.properties.edge!.enum).toEqual(expect.arrayContaining(["university", "addressCountry"]));
    const field = new RegExp(schema.properties.spec.properties.where.items.anyOf[0]!.properties.field.pattern);
    expect(field.test("university.name")).toBe(true);
    expect(field.test("University.name")).toBe(false);
    expect(field.test("name")).toBe(false);
  });
});

describe("the ask Task", () => {
  it("reads the spec out of the object the model writes", async () => {
    const asked = input("Which universities won the most prizes?");
    const output = ask.output!(asked, await link(asked)) as { validate: (v: unknown) => Promise<unknown> | unknown };
    expect(await output.validate({ spec: byUniversity })).toEqual({ success: true, value: byUniversity });
    expect(await output.validate(byUniversity)).toMatchObject({ success: false });
  });

  it("answers with the pattern the model wrote: prizes by university, under a chip on the prizes", async () => {
    const asked = input("Which universities won the most prizes?", { under: [["LaureateAward"]] });
    const proposal = await runTask(ask, asked, { model: asking(byUniversity), id: "a1" });
    expect(proposal.verdict).toEqual({ ok: true });
    const answer = askAnswer(proposal.value, asked, "a1")!;
    expect(answer.pattern).toEqual(PRIZES_BY_UNIVERSITY);
    expect(answer.tile).toMatchObject({ id: "a1", kind: "chart", x: "university.name" });
  });

  it("offers questions as the specs of the elements it is answered with", async () => {
    const offers = await askOffers({ model: answering({ elements: [{ spec: byUniversity }] }) as LanguageModel, graph: NOBEL, count: 1 });
    expect(offers.map((o) => o.value)).toEqual([byUniversity]);
  });

  it("sends a field the pattern does not have back, at its pointer, and takes the repair", async () => {
    const lost: AskSpec = { ...byUniversity, show: { ...byUniversity.show, x: "University.name" } as AskSpec["show"] };
    const proposal = await runTask({ ...ask, attempts: 2 }, input("Prizes by university?"), { model: asking(lost, byUniversity) });
    expect(proposal.attempts).toBe(2);
    expect(proposal.verdict).toEqual({ ok: true });
  });

  it("says what the graph refuses: an unnamed vertex, an edge it lacks, a property, a count, a chip out of reach", async () => {
    const refusal = async (spec: AskSpec, extra: Partial<AskInput> = {}) => {
      const proposal = await runTask({ ...ask, attempts: 1 }, input("", extra), { model: asking(spec) });
      return proposal.verdict.ok ? [] : "diagnostics" in proposal.verdict ? proposal.verdict.diagnostics.map((d) => [d.code, d.at]) : [];
    };
    const chart = (x: string, more: Partial<AskSpec> = {}): AskSpec => ({ ...byUniversity, show: { ...byUniversity.show, x } as AskSpec["show"], ...more });
    expect(await refusal(chart("university.name", { match: [{ type: "LaureateAward" }] }))).toEqual([["ask/unnamed", "/match/0"]]);
    expect(await refusal(chart("university.name", { match: [award, { edge: "category", direction: "out" }, university] }))).toEqual([["ask/no-match", "/match"]]);
    expect(await refusal(chart("university.label"))).toEqual([["ask/unmatched", "/show/x"]]);
    expect(await refusal(chart("country.name"))).toEqual([["ask/unmatched", "/show/x"]]);
    expect(await refusal({ ...byUniversity, where: [{ field: "university.age", in: [3] }] })).toEqual([["ask/unmatched", "/where/0/field"]]);
    expect(await refusal({ ...byUniversity, show: { ...byUniversity.show, y: { op: "count", variable: "laureate" } } as AskSpec["show"] })).toEqual([["ask/unmatched", "/show/y/variable"]]);
  });
});

describe("askAlternatives", () => {
  // Women laureates by the country they were born in.
  const women: AskSpec = {
    match: [{ as: "laureate", type: "Laureate" }, { edge: "birthPlace", direction: "out" }, { as: "country", type: "Country" }],
    show: { kind: "chart", type: "bar", x: "country.name", y: { op: "count" } },
    where: [{ field: "laureate.gender", in: ["female"] }],
  };

  it("offers each slot's other values, as whole specs, a condition's as the graph answers them", async () => {
    const values = await askValues(women, NOBEL);
    const chips = askAlternatives(women, input(""), values);
    expect(chips.map((c) => [c.slot, c.label, c.value])).toEqual([
      ["count", "Counting", "laureate"],
      ["x", "By", "country.name"],
      ["where.0", "laureate.gender", "female"],
    ]);
    expect(chips[0]!.options.map((o) => o.label)).toEqual(["country"]);
    const where = chips[2]!.options;
    expect(where.map((o) => o.label)).toEqual(["male", "any"]);
    expect(where[0]!.spec.where).toEqual([{ field: "laureate.gender", in: ["male"] }]);
    expect(where[1]!.spec.where).toEqual([]);
  });

  it("offers a condition only any until its values are read", () => {
    const chip = askAlternatives(women, input("")).find((c) => c.slot === "where.0")!;
    expect(chip.options.map((o) => o.label)).toEqual(["any"]);
  });
});
