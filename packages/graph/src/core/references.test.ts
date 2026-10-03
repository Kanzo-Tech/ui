import { describe, expect, it } from "vitest";
import { attach } from "../../test/corpus";
import { corpusReferences } from "./references";

describe("the corpus's joins", () => {
  it("names each edge table's src and dst as the dense_id of the vertex tables it joins", async () => {
    const { coordinator, from } = await attach();
    expect(await corpusReferences(coordinator, from)).toEqual([
      { table: "Person_knows_Person", column: "src", references: { table: "Person", column: "dense_id" } },
      { table: "Person_knows_Person", column: "dst", references: { table: "Person", column: "dense_id" } },
      { table: "Person_livesIn_Place", column: "src", references: { table: "Person", column: "dense_id" } },
      { table: "Person_livesIn_Place", column: "dst", references: { table: "Place", column: "dense_id" } },
      { table: "Person_tagged_Tag", column: "src", references: { table: "Person", column: "dense_id" } },
      { table: "Person_tagged_Tag", column: "dst", references: { table: "Tag", column: "dense_id" } },
    ]);
  });
});
