import { describe, expect, it } from "vitest";
import type { AskSpec } from "./ask.js";
import type { AnswerOutput } from "./read.js";
import { answerSummary, answerTitle, fieldWords, questionOf } from "./words.js";

const bar = (x: string, extra: Partial<AskSpec> = {}): AskSpec => ({ of: "Award", show: { kind: "chart", type: "bar", x, y: { op: "count" } }, ...extra });

const read = (rows: Record<string, unknown>[], extra: Partial<AnswerOutput> = {}) =>
  ({ answer: {} as AnswerOutput["answer"], rows, truncated: false, under: [], unanswered: [], ...extra }) as AnswerOutput;

describe("answerTitle", () => {
  it("names the measured type per the grouped type, not Type.field", () => {
    expect(answerTitle(bar("Laureate.name"))).toBe("Awards per laureate");
    expect(answerTitle(bar("University.name"))).toBe("Awards per university");
  });

  it("says the field when it is not the type's name, and drops the type when it is the measured one", () => {
    expect(answerTitle(bar("Laureate.gender"))).toBe("Awards by laureate gender");
    expect(answerTitle(bar("Award.year"))).toBe("Awards by year");
    expect(answerTitle({ of: "Award", show: { kind: "chart", type: "bar", x: "LaureateAward.birthCountry", y: { op: "avg", field: "Award.share" } } })).toBe(
      "Average share by laureate award birth country",
    );
  });

  it("titles a figure by what it counts, and a table by its rows", () => {
    expect(answerTitle({ of: "University", show: { kind: "stat", measure: { op: "count" } } })).toBe("Universities");
    expect(answerTitle({ of: "Laureate", show: { kind: "table", columns: ["Laureate.name"] } })).toBe("Laureates");
  });
});

describe("fieldWords", () => {
  it("reads a type's name as the type, a column on the measured type alone", () => {
    expect(fieldWords("Category.name", "Award")).toBe("category");
    expect(fieldWords("Award.category", "Award")).toBe("category");
    expect(fieldWords("Book.title", "Award")).toBe("book");
    expect(fieldWords("Laureate.birth_date", "Award")).toBe("laureate birth date");
  });
});

describe("questionOf", () => {
  it("asks in the same words", () => {
    expect(questionOf(bar("University.name", { where: [{ field: "Category.name", in: ["Physics"] }] }))).toBe(
      "How many awards per university, where category is Physics?",
    );
  });
});

describe("answerSummary", () => {
  it("names a tie together, and says what the count is of: every bar tied", () => {
    const rows = ["Marie Curie", "Linus Pauling", "John Bardeen", "Frederick Sanger"].map((name) => ({ "Laureate.name": name, count: 2 }));
    expect(answerSummary(read(rows), bar("Laureate.name", { top: 4 }))).toBe(
      "The top 4 laureates, with 2 awards each: Marie Curie, Linus Pauling, John Bardeen and Frederick Sanger.",
    );
    expect(answerSummary(read(rows), bar("Laureate.name"))).toBe(
      "4 laureates, with 2 awards each: Marie Curie, Linus Pauling, John Bardeen and Frederick Sanger.",
    );
  });

  it("leads with the highest, whatever order the rows came in, and names the runners-up together", () => {
    const rows = [
      { "University.name": "Caltech", count: 5 },
      { "University.name": "Harvard University", count: 9 },
      { "University.name": "Univ. of California", count: 12 },
      { "University.name": "MIT", count: 9 },
    ];
    expect(answerSummary(read(rows), bar("University.name"))).toBe(
      "Univ. of California leads with 12 awards, then Harvard University and MIT with 9 awards each — 4 universities in all.",
    );
  });

  it("names leaders tied ahead of the rest, and a cut read as the first", () => {
    const rows = [
      { "Laureate.name": "Marie Curie", count: 2 },
      { "Laureate.name": "Linus Pauling", count: 2 },
      { "Laureate.name": "Ada Yonath", count: 1 },
    ];
    expect(answerSummary(read(rows, { truncated: true }), bar("Laureate.name"))).toBe(
      "Marie Curie and Linus Pauling lead with 2 awards each, then Ada Yonath with 1 award — the first 3 laureates.",
    );
  });

  it("says a figure in words", () => {
    expect(answerSummary(read([{ count: 1 }]), { of: "University", show: { kind: "stat", measure: { op: "count" } } })).toBe("1 university.");
    expect(answerSummary(read([{ "avg Award.share": 0.4567 }]), { of: "Award", show: { kind: "stat", measure: { op: "avg", field: "Award.share" } } })).toBe(
      "Average share: 0.46.",
    );
  });
});
