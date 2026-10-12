import { relationKey } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { runTask } from "../task/index.js";
import { ask, askAnswer, link, type AskInput, type AskSpec } from "./ask.js";
import { NOBEL, TYPES, answering } from "../testing/nobel.js";

const input = (question: string, extra: Partial<AskInput> = {}): AskInput => ({ question, graph: NOBEL, types: TYPES, ...extra });

const byUniversity: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "University.name", y: { op: "count" } } };

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
    expect(link(input("What is going on?")).types).toHaveLength(TYPES.length);
  });
});

describe("the ask Task", () => {
  it("leaves the relation to the resolver: prizes by university, under a chip on the prizes", async () => {
    const asked = input("Which universities won the most prizes?", { under: ["LaureateAward"] });
    const proposal = await runTask(ask, asked, { model: answering(byUniversity), id: "a1" });
    expect(proposal.verdict).toEqual({ ok: true });
    const answer = askAnswer(proposal.value, asked, "a1")!;
    expect(relationKey(NOBEL, answer.relation)).toBe("LaureateAward>university>University");
    expect(answer.show).toMatchObject({ id: "a1", kind: "chart", x: "University.name" });
  });

  it("asks which way when two are equally short: a prize's country", async () => {
    const byCountry: AskSpec = { of: "LaureateAward", show: { kind: "chart", type: "bar", x: "Country.name", y: { op: "count" } } };
    const proposal = await runTask(ask, input("Prizes by country?"), { model: answering(byCountry) });
    expect(proposal.verdict).toMatchObject({
      ok: false,
      decision: {
        id: "relation",
        options: [
          { id: "LaureateAward>laureate>Laureate>birthPlace>Country" },
          { id: "LaureateAward>university>University>addressCountry>Country" },
        ],
      },
    });
    const chosen = askAnswer(proposal.value, input("Prizes by country?"), "a2", {
      root: "LaureateAward",
      path: [
        { edge: "LaureateAward_university_University", direction: "out" },
        { edge: "University_addressCountry_Country", direction: "out" },
      ],
    })!;
    expect(relationKey(NOBEL, chosen.relation)).toBe("LaureateAward>university>University>addressCountry>Country");
  });

  it("sends a spec no relation reaches back, and takes the repair", async () => {
    // From a country, covering a laureate, a university and a category is five hops: out of reach.
    const lost: AskSpec = {
      of: "Country",
      show: { kind: "chart", type: "bar", x: "Category.name", y: { op: "count" } },
      where: [
        { field: "Laureate.gender", in: ["female"] },
        { field: "University.name", in: ["MIT"] },
      ],
    };
    const proposal = await runTask({ ...ask, attempts: 2 }, input("Women by category?"), { model: answering(lost, { ...byUniversity, of: "LaureateAward" }) });
    expect(proposal.attempts).toBe(2);
    expect(proposal.verdict).toEqual({ ok: true });
  });
});
