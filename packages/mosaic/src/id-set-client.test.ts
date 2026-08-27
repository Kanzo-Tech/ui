import { Selection } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { IdSetClient } from "./id-set-client.js";

const make = (as: Selection = Selection.crossfilter()) => {
  const survivors = vi.fn();
  const client = new IdSetClient({
    as,
    filterBy: Selection.crossfilter(),
    idField: "id",
    onSurvivors: survivors,
    table: "nodes",
  });
  return { as, client, survivors };
};

describe("IdSetClient", () => {
  it("asks only for the id column", () => {
    const { client } = make();
    expect(String(client.query())).toContain('"id"');
    expect(String(client.query())).toContain("nodes");
  });

  it("hands the surviving ids on, through Arrow's typed path", () => {
    const { client, survivors } = make();
    client.queryResult({ getChild: () => ({ toArray: () => new Int32Array([4, 5]) }) });
    expect(survivors).toHaveBeenCalledWith([4, 5]);
  });

  // The reason it uses `column` rather than a cast: a query can answer with either shape.
  it("hands them on when Arrow offers no typed column", () => {
    const { client, survivors } = make();
    client.queryResult([{ id: "a" }, { id: "b" }]);
    expect(survivors).toHaveBeenCalledWith(["a", "b"]);
  });

  it("publishes a points clause the rest of the page filters by", () => {
    const { as, client } = make();
    client.publish([1, 2]);

    expect(as.clauses).toHaveLength(1);
    expect(as.clauses[0]?.value).toEqual([[1], [2]]);
  });

  it("retracts on null rather than publishing an empty set", () => {
    const { as, client } = make();
    client.publish([1]);
    client.publish(null);

    expect(as.clauses[0]?.value).toBeUndefined();
  });

  // Declining the self-exemption is what makes the fade read as the brush.
  it("does not exempt itself from its own clause", () => {
    const { as, client } = make();
    client.publish([1]);

    expect(as.clauses[0]?.clients?.size).toBe(0);
  });
});
