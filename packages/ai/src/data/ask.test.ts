import { relationKey, type JoinGraph } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { runTask } from "../task/index.js";
import { ask, askAlternatives, askAnswer, askSchema, link, type AskInput, type AskSpec } from "./ask.js";
import { NOBEL, asking } from "../testing/nobel.js";

const input = (question: string, extra: Partial<AskInput> = {}): AskInput => ({ question, graph: NOBEL, ...extra });

const byUniversity: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "university.name", y: { op: "count" } } };

describe("link", () => {
  it("offers the types the question names, and their neighbours", () => {
    const types = link(input("Which universities won the most prizes?")).types.map((t) => t.relation.root);
    expect(types).toEqual(["LaureateAward", "University", "Country"]);
  });

  it("finds a type by a value it holds, and keeps what the page's chips are on", () => {
    const types = link(input("And in Germany?", { under: ["LaureateAward"] })).types.map((t) => t.relation.root);
    expect(types).toContain("Country");
    expect(types).toContain("LaureateAward");
  });

  it("offers every type to a question that names none", () => {
    expect(link(input("What is going on?")).types).toHaveLength(NOBEL.types.length);
  });
});

describe("the ask schema", () => {
  it("is one branch per type offered, each its own enum of paths from it", () => {
    const schema = askSchema(link(input("Which universities won the most prizes?")), NOBEL) as {
      properties: { spec: { anyOf: { properties: { of: { const: string } } }[] } };
      $defs: Record<string, { enum: string[] }>;
    };
    expect(schema.properties.spec.anyOf.map((b) => b.properties.of.const)).toEqual(["LaureateAward", "University", "Country"]);
    expect(schema.$defs.f0!.enum).toEqual(expect.arrayContaining(["share", "university.name", "laureate.birthPlace.name", "university.addressCountry.name"]));
    // Back along the edge that leads from a university to its prizes, and on from them.
    expect(schema.$defs.f1!.enum).toEqual(expect.arrayContaining(["name", "^university.share", "^university.category.name"]));
    // No key, and no type's name where a path goes.
    expect(JSON.stringify(schema.$defs)).not.toMatch(/"id"|\.id"|University\.name/);
  });
});

describe("the ask Task", () => {
  it("hands the model an object at the schema's root, and reads the spec out of it", async () => {
    // Anthropic's and OpenAI's tool inputs refuse a root `anyOf`: the branches are the `spec` property.
    const context = link(input("Which universities won the most prizes?"));
    const schema = askSchema(context, NOBEL);
    expect(schema).toMatchObject({ type: "object", required: ["spec"], additionalProperties: false });
    expect(schema).not.toHaveProperty("anyOf");
    expect(schema).not.toHaveProperty("oneOf");
    const one = askSchema(link(input("How many?", { graph: { ...NOBEL, types: NOBEL.types.slice(0, 1) } })), NOBEL);
    expect(one).toMatchObject({ type: "object", required: ["spec"] });
    const output = ask.output!(input("Which universities won the most prizes?"), context) as { jsonSchema: unknown; validate: (v: unknown) => Promise<unknown> | unknown };
    expect(await output.validate({ spec: byUniversity })).toEqual({ success: true, value: byUniversity });
    expect(await output.validate(byUniversity)).toMatchObject({ success: false });
  });

  it("takes the relation from the paths the model wrote: prizes by university, under a chip on the prizes", async () => {
    const asked = input("Which universities won the most prizes?", { under: ["LaureateAward"] });
    const proposal = await runTask(ask, asked, { model: asking(byUniversity), id: "a1" });
    expect(proposal.verdict).toEqual({ ok: true });
    const answer = askAnswer(proposal.value, asked, "a1")!;
    expect(relationKey(NOBEL, answer.relation)).toBe("LaureateAward>university>University");
    expect(answer.tile).toMatchObject({ id: "a1", kind: "chart", x: "university.name" });
  });

  it("asks nothing when two paths reach one field: the model's path is the answer's", async () => {
    const byCountry: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "university.addressCountry.name", y: { op: "count" } } };
    const proposal = await runTask(ask, input("Prizes by country?"), { model: asking(byCountry) });
    expect(proposal.verdict).toEqual({ ok: true });
    expect(relationKey(NOBEL, askAnswer(proposal.value, input(""), "a2")!.relation)).toBe("LaureateAward>university>University>addressCountry>Country");
  });

  it("sends a path the graph does not have back, at its pointer, and takes the repair", async () => {
    const lost: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "University.name", y: { op: "count" } } };
    const proposal = await runTask({ ...ask, attempts: 2 }, input("Prizes by university?"), { model: asking(lost, byUniversity) });
    expect(proposal.attempts).toBe(2);
    expect(proposal.verdict).toEqual({ ok: true });
  });

  it("says what the joins refuse: no such step, no such field, two branches, a chip out of reach", async () => {
    const refusal = async (spec: AskSpec, extra: Partial<AskInput> = {}) => {
      const proposal = await runTask({ ...ask, attempts: 1 }, input("", extra), { model: asking(spec) });
      return proposal.verdict.ok ? [] : "diagnostics" in proposal.verdict ? proposal.verdict.diagnostics.map((d) => [d.code, d.at]) : [];
    };
    const chart = (x: string, color?: string): AskSpec => ({ of: "LaureateAward", show: { kind: "chart", type: "bar", x, y: { op: "count" }, ...(color ? { color } : {}) } });
    expect(await refusal(chart("university.label"))).toEqual([["join/no-field", "/show/x"]]);
    expect(await refusal(chart("university.city.name"))).toEqual([["join/no-step", "/show/x"]]);
    expect(await refusal(chart("category.name", "university.name"))).toEqual([["join/branches", "/show/color"]]);
    expect(await refusal({ ...chart("category.name"), where: [{ field: "laureate.age", in: [3] }] })).toEqual([["join/no-field", "/where/0/field"]]);
    expect(await refusal({ of: "Category", show: { kind: "stat", measure: { op: "count" } } }, { under: ["Country"] })).toEqual([["ask/out-of-reach", "/of"]]);
  });
});

describe("askAlternatives", () => {
  // Women laureates by the country they were born in.
  const women: AskSpec = {
    of: "Laureate",
    show: { kind: "chart", type: "bar", x: "birthPlace.name", y: { op: "count" } },
    where: [{ field: "gender", in: ["female"] }],
  };

  it("offers each slot's other values, as whole specs", () => {
    const chips = askAlternatives(women, input(""));
    expect(chips.map((c) => [c.slot, c.label, c.value])).toEqual([
      ["of", "Counting", "Laureate"],
      ["x", "By", "birthPlace.name"],
      ["where.0", "gender", "female"],
    ]);
    const where = chips[2]!.options;
    expect(where.map((o) => o.label)).toEqual(["male", "any"]);
    expect(where[0]!.spec.where).toEqual([{ field: "gender", in: ["male"] }]);
    expect(where[1]!.spec.where).toEqual([]);
  });

  it("offers the other of two paths of one length to the same field first", () => {
    const germany: AskSpec = { ...byUniversity, show: { ...byUniversity.show, x: "category.name" } as AskSpec["show"], where: [{ field: "laureate.birthPlace.name", in: ["Germany"] }] };
    const chip = askAlternatives(germany, input("")).find((c) => c.slot === "where.0")!;
    expect(chip.options[0]).toEqual({ label: "university.addressCountry.name", spec: { ...germany, where: [{ field: "university.addressCountry.name", in: ["Germany"] }] } });
    const by = askAlternatives({ ...byUniversity, show: { ...byUniversity.show, x: "laureate.birthPlace.name" } as AskSpec["show"] }, input("")).find((c) => c.slot === "x")!;
    expect(by.options[0]!.label).toBe("university.addressCountry.name");
  });
});

describe("a multi-valued property", () => {
  // A laureate's nicknames, a row per value in a table of their own, as `readJoinGraph` reads fossil's.
  const NICKNAMES: JoinGraph = {
    types: [
      ...NOBEL.types,
      {
        name: "Laureate_nickname",
        table: "Laureate_nickname",
        key: "src",
        value: "nickname",
        columns: [
          { name: "src", type: "UBIGINT", role: "endpoint" },
          { name: "nickname", type: "VARCHAR", stats: { nullCount: 0, distinctCount: 3, mostCommonVals: ["Marie"], mostCommonFreqs: [0.5] } },
        ],
      },
    ],
    edges: [...NOBEL.edges, { name: "Laureate_nickname", label: "nickname", source: "Laureate", destination: "Laureate_nickname", table: "Laureate_nickname", src: "src", dst: "src" }],
  };

  it("is a path Ask may write and read its value by, and never a type it measures", () => {
    const context = link({ question: "What were laureates called?", graph: NICKNAMES });
    expect(context.types.map((t) => t.relation.root)).not.toContain("Laureate_nickname");
    const schema = askSchema(context, NICKNAMES) as { $defs: Record<string, { enum: string[] }> };
    expect(Object.values(schema.$defs).flatMap((d) => d.enum)).toContain("laureate.nickname");
    const spec: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "laureate.nickname", y: { op: "count" } } };
    const answer = askAnswer(spec, { graph: NICKNAMES }, "a");
    expect(answer?.relation.path.map((h) => h.edge)).toEqual(["LaureateAward_laureate_Laureate", "Laureate_nickname"]);
  });
});
