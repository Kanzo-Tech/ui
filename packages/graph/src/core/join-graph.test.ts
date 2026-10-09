import { relationQuery } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { joinGraphOf } from "./join-graph";
import type { Column, Structure } from "./structure";

const columns = (entries: [string, string | null][]) =>
  new Map<string, Column>(entries.map(([name, role]) => [name, { type: "string", role, datatype: null }]));

const STRUCTURE: Structure = {
  from: "jobs/7",
  key: "dense_id",
  size: 30,
  vertices: [
    {
      name: "Person",
      first: 0,
      rows: 20,
      identity: "subject",
      columns: columns([["dense_id", "address"], ["subject", "identity"], ["country", null], ["age", null]]),
    },
    { name: "Post", first: 20, rows: 10, identity: "subject", columns: columns([["dense_id", "address"], ["length", null]]) },
  ],
  edges: [{ name: "Post_hasCreator_Person", label: "hasCreator", source: "Post", destination: "Person", rows: 10 }],
};

describe("joinGraphOf", () => {
  it("keys a type by its address, projects the columns the writer gave no role, and joins edges on src and dst", () => {
    const graph = joinGraphOf(STRUCTURE);
    expect(graph.types.map((t) => [t.name, t.key, t.columns])).toEqual([
      ["Person", "dense_id", ["country", "age"]],
      ["Post", "dense_id", ["length"]],
    ]);
    expect(graph.edges[0]).toMatchObject({ label: "hasCreator", source: "Post", destination: "Person", src: "src", dst: "dst" });
    expect(String(relationQuery(graph, { root: "Person", path: [{ edge: "Post_hasCreator_Person", direction: "in" }] }))).toContain(
      'FROM "jobs/7"."Person" AS "t0" JOIN "jobs/7"."Post_hasCreator_Person" AS "e1"',
    );
  });

  it("takes a self-loop's source end from src and its destination end from dst", () => {
    const graph = joinGraphOf({ ...STRUCTURE, edges: [{ name: "Person_knows_Person", label: "knows", source: "Person", destination: "Person", rows: 5 }] });
    expect(graph.edges[0]).toMatchObject({ src: "src", dst: "dst" });
  });
});
