import { describe, expect, it } from "vitest";
import { migrateDashboards } from "./dashboard-migrate.js";

const V1 = {
  version: 1,
  byType: {
    Person: {
      version: 1,
      filters: [{ field: "country" }],
      stats: [{ id: "n", label: "People", measure: { op: "count" }, trend: "born" }],
      cards: [
        { id: "c", type: "bar", x: "country", y: { op: "avg", field: "age" }, color: "gender", span: 2, title: "Ages" },
        { id: "d", type: "dot", x: "age", y: { op: "value", field: "height" } },
      ],
      detail: { columns: ["country", "age"] },
    },
  },
};

describe("migrateDashboards", () => {
  it("keys each type's spec by the relation of that type alone, and renames every field as that relation names it", () => {
    expect(migrateDashboards(V1)).toEqual({
      version: 2,
      byRelation: {
        Person: {
          version: 2,
          filters: [{ field: "Person.country" }],
          tiles: [
            { id: "n", kind: "stat", span: 1, title: "People", measure: { op: "count" }, trend: "Person.born" },
            {
              id: "c",
              kind: "chart",
              span: 2,
              title: "Ages",
              type: "bar",
              x: "Person.country",
              y: { op: "avg", field: "Person.age" },
              color: "Person.gender",
            },
            { id: "d", kind: "chart", span: 1, type: "dot", x: "Person.age", y: { op: "value", field: "Person.height" } },
            { id: "rows", kind: "table", span: 3, columns: ["Person.country", "Person.age"] },
          ],
        },
      },
    });
  });

  it("reads nothing as no dashboards and a current document as itself, and survives JSON both ways", () => {
    expect(migrateDashboards(null)).toEqual({ version: 2, byRelation: {} });
    const current = migrateDashboards(V1);
    expect(migrateDashboards(JSON.parse(JSON.stringify(current)))).toEqual(current);
  });

  it("refuses a version it does not know rather than reading it as nothing", () => {
    expect(() => migrateDashboards({ version: 3, byRelation: {} })).toThrow(/no migration from dashboards version 3/);
  });
});
