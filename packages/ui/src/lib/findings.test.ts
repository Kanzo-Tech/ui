import { describe, expect, it } from "vitest";
import { type Finding, groupFindings, tallyFindings, worstOf } from "./findings";

/** A place as an RDF host would hold one — the library never reads it. */
interface Node {
  focus: string;
  path: string;
}

const minCount = { id: "sh:MinCountConstraintComponent", label: "MinCount" };
const datatype = { id: "sh:DatatypeConstraintComponent", label: "Datatype" };

const at = (
  focus: string,
  path: string,
  severity: Finding["severity"] = "violation",
  rule = minCount,
): Finding<Node> => ({
  severity,
  message: `${path} is missing`,
  rule,
  place: { focus, path },
});

const byRuleAndPath = (finding: Finding<Node>) => `${finding.rule.id}|${finding.place.path}`;

describe("groupFindings", () => {
  it("keeps one group per key, counting every member and sampling the first", () => {
    const findings = [
      at("Project/1", "totalCost"),
      at("Project/2", "totalCost"),
      at("Project/3", "title"),
      at("Project/4", "totalCost"),
      at("Project/5", "totalCost"),
    ];
    const [cost, title] = groupFindings(findings, byRuleAndPath, 2);

    expect(cost).toMatchObject({ count: 4, message: "totalCost is missing", rule: minCount });
    expect(cost!.places.map((place) => place.focus)).toEqual([
      "Project/1",
      "Project/2",
      "Project/4",
      "Project/5",
    ]);
    expect(cost!.sample).toEqual([findings[0], findings[1]]);
    expect(title).toMatchObject({ count: 1, sample: [findings[2]] });
  });

  it("orders the groups worst first, and by first appearance within a severity", () => {
    const findings = [
      at("A", "note", "info"),
      at("B", "label", "warning"),
      at("C", "title"),
      at("D", "seal", "warning"),
      at("E", "cost"),
    ];
    expect(groupFindings(findings, byRuleAndPath).map((group) => group.places[0]!.path)).toEqual([
      "title",
      "cost",
      "label",
      "seal",
      "note",
    ]);
  });

  it("wears the worst severity among its members", () => {
    const findings = [at("A", "cost", "warning", datatype), at("B", "cost", "violation", datatype)];
    const [group] = groupFindings(findings, (finding) => finding.rule.id);
    expect(group!.severity).toBe("violation");
  });
});

describe("tallyFindings", () => {
  it("counts a group by its count, not by its sample", () => {
    const [group] = groupFindings(
      Array.from({ length: 362 }, (_, i) => at(`Project/${i}`, "totalCost")),
      byRuleAndPath,
    );
    const tally = tallyFindings([group!, at("Project/x", "title", "warning")]);
    expect(tally).toEqual({ violation: 362, warning: 1, info: 0, total: 363 });
    expect(worstOf(tally)).toBe("violation");
    expect(worstOf(tallyFindings([]))).toBeUndefined();
  });
});
