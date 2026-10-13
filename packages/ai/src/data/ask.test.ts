import { relationKey } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { runTask } from "../task/index.js";
import { ask, askAlternatives, askAnswer, link, type AskInput, type AskSpec } from "./ask.js";
import { wherePredicates } from "./answer.js";
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
    expect(answer.show).toMatchObject({ id: "a1", kind: "chart", x: "University.name", title: "Laureate awards per university" });
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
      relation: {
        root: "LaureateAward",
        path: [
          { edge: "LaureateAward_university_University", direction: "out" },
          { edge: "University_addressCountry_Country", direction: "out" },
        ],
      },
      through: [],
    })!;
    expect(relationKey(NOBEL, chosen.relation)).toBe("LaureateAward>university>University>addressCountry>Country");
  });

  it("sends a spec no relation reaches back, and takes the repair", async () => {
    // From a country, showing a category, a university and a laureate is four hops: out of reach.
    const lost: AskSpec = {
      of: "Country",
      show: { kind: "chart", type: "bar", x: "Category.name", y: { op: "count" }, color: "University.name", facet: "Laureate.gender" },
    };
    const proposal = await runTask({ ...ask, attempts: 2 }, input("Women by category?"), { model: answering(lost, { ...byUniversity, of: "LaureateAward" }) });
    expect(proposal.attempts).toBe(2);
    expect(proposal.verdict).toEqual({ ok: true });
  });
});

describe("a filter on one branch, a group on another", () => {
  it("answers a filter on one branch and a group on another", async () => {
    // Physics prizes by university: LaureateAward→Category and LaureateAward→University are two
    // branches from the prize, which one path could not hold.
    const physics: AskSpec = { ...byUniversity, where: [{ field: "Category.name", in: ["Physics"] }] };
    const asked = input("Which universities have the most Physics prizes?");
    const proposal = await runTask(ask, asked, { model: answering(physics) });
    expect(proposal.verdict).toEqual({ ok: true });
    const answer = askAnswer(proposal.value, asked, "a3")!;
    expect(relationKey(NOBEL, answer.relation)).toBe("LaureateAward>university>University");
    expect(answer.through!.map((r) => relationKey(NOBEL, r))).toEqual(["LaureateAward>category>Category"]);
    // The condition crosses in by the prize's key, through its own branch.
    const [predicate] = wherePredicates(answer, [], NOBEL);
    expect(String(predicate)).toMatch(/^\("id" IN \(SELECT "id" FROM .*"LaureateAward_category_Category".* WHERE \("Category\.name" IN \('Physics'\)\)\)\)$/);
  });
});

describe("askAlternatives", () => {
  // Women laureates by the country they were born in: one path, Laureate>birthPlace>Country.
  const women: AskSpec = {
    of: "Laureate",
    show: { kind: "chart", type: "bar", x: "Country.name", y: { op: "count" } },
    where: [{ field: "Laureate.gender", in: ["female"] }],
  };

  it("offers each slot's other values, as whole specs", () => {
    const chips = askAlternatives(women, input(""));
    expect(chips.map((c) => [c.slot, c.label, c.value])).toEqual([
      ["of", "Counting", "laureates"],
      ["x", "By", "country"],
      ["where.0", "Gender", "female"],
    ]);
    const where = chips[2]!.options;
    expect(where.map((o) => o.label)).toEqual(["male", "any"]);
    expect(where[0]!.spec.where).toEqual([{ field: "Laureate.gender", in: ["male"] }]);
    expect(where[1]!.spec.where).toEqual([]);
  });

  it("offers only what the oracles accept: no x two relations reach equally", () => {
    const by = askAlternatives(byUniversity, input("")).find((c) => c.slot === "x")!;
    // A prize reaches a country two equally short ways, so Country.name is not an option.
    expect(by.options.map((o) => o.label)).not.toContain("country");
    expect(by.options.map((o) => o.label)).toContain("category");
  });
});
