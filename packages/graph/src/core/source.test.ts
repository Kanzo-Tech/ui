import { Query } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { attach } from "../../test/corpus";
import { identityOf, placed, readLinks, rowsOf, sizeOf, verticesOf } from "./source";

/**
 * The global id, over a real DuckDB through a real coordinator: what the `Graph` says of each type
 * is read as it is said, and `dense_id` is the sum it is defined as — each type's index, offset by
 * the counts of the types before it in the graph's order. What GraphAr's information files say is
 * `@kanzo-tech/graphar-duckdb`'s to read and test; nothing here names a column of the format.
 */
describe("the global id, as the canvas reads it", () => {
  it("numbers the types in the graph's order, each from the counts before it", async () => {
    const corpus = await attach();
    expect(placed(corpus.graph).map(({ type, first }) => [type.type, first, type.count, identityOf(type)])).toEqual([
      ["Person", 0, 10, "subject"],
      ["Place", 10, 6, "subject"],
      ["Tag", 16, 4, "subject"],
    ]);
    expect(sizeOf(corpus.graph)).toBe(20);
    const place = (await corpus.coordinator.query(Query.from(rowsOf(placed(corpus.graph)[1]!)).select("dense_id", "name").orderby("dense_id"), {
      type: "json",
    })) as Iterable<{ dense_id: number; name: string }>;
    expect(Array.from(place, (r) => [Number(r.dense_id), r.name])).toEqual([0, 1, 2, 3, 4, 5].map((i) => [10 + i, `Place ${i}`]));
  });

  it("gives each edge its ends as global ids, from the Graph's per-type indices", async () => {
    const corpus = await attach();
    const links = await readLinks(corpus.graph);
    const pairs = Array.from({ length: links.length / 2 }, (_, i) => [links[2 * i]!, links[2 * i + 1]!]);
    expect(pairs.slice(9, 19)).toEqual(Array.from({ length: 10 }, (_, i) => [i, 10 + (i % 6)]));
    expect(pairs).toHaveLength(20);
  });

  it("is every vertex as one relation, each type's vertex its index where the row is of it", async () => {
    const corpus = await attach();
    const union = verticesOf(corpus.graph);
    expect(union).toBe(verticesOf(corpus.graph));
    expect(union.vertices.map((v) => v.type)).toEqual(["Person", "Place", "Tag"]);
    const place = union.vertices[1]!;
    const rows = (await corpus.coordinator.query(Query.from(union.table).select({ id: "dense_id", index: place.index }).orderby("dense_id"), {
      type: "json",
    })) as Iterable<{ id: number; index: number | null }>;
    expect(Array.from(rows, (r) => (r.index === null ? null : Number(r.index)))).toEqual([...Array(10).fill(null), 0, 1, 2, 3, 4, 5, ...Array(4).fill(null)]);
  });
});
