import { describe, expect, it } from "vitest";
import { attach } from "../../test/corpus";
import { readCatalog } from "./catalog";

/**
 * The one read of a corpus's catalog, over a real DuckDB through a real coordinator: every fact the
 * catalog states reaches the structure as it is stated, and nothing is taken from a table's name.
 */
describe("readCatalog", () => {
  it("takes an edge's label and its endpoint keys from fossil_tables, never from the table's name", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `ALTER VIEW ${corpus.from}.fossil_tables RENAME TO written;
       CREATE VIEW ${corpus.from}.fossil_tables AS
         SELECT * REPLACE (CASE table_name WHEN 'Person_knows_Person' THEN 'acquaintance' ELSE label END AS label) FROM ${corpus.from}.written;`,
    );
    const { edges } = await readCatalog(corpus.coordinator, corpus.from);
    expect(edges.map((e) => [e.name, e.label, e.sourceKey, e.destinationKey])).toEqual([
      ["Person_knows_Person", "acquaintance", "src", "dst"],
      ["Person_livesIn_Place", "livesIn", "src", "dst"],
      ["Person_tagged_Tag", "tagged", "src", "dst"],
    ]);
  });

  it("describes each column — the engine's type, its term type and datatype, its annotations and the writer's counts", async () => {
    const corpus = await attach();
    const { vertices } = await readCatalog(corpus.coordinator, corpus.from);
    const person = vertices.find((v) => v.name === "Person")!;
    expect(person.candidateKeys).toEqual(["dense_id", "subject", "name", "score", "born"]);
    expect(person.iri).toBe("https://example.org/Person");
    expect(person.annotations).toEqual([
      { predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { value: "person", language: "en" } },
      { predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { value: "persona", language: "es" } },
    ]);
    expect(person.columns.get("subject")).toMatchObject({ type: "string", sqlType: "VARCHAR", role: "identity", termType: "rr:IRI" });
    expect(person.columns.get("born")).toMatchObject({
      type: "int32",
      sqlType: "INTEGER",
      role: null,
      datatype: "http://www.w3.org/2001/XMLSchema#gYear",
      annotations: [{ predicate: "http://www.w3.org/2000/01/rdf-schema#label", object: { value: "year of birth", language: "en" } }],
      stats: { nullCount: 0, distinctCount: 10, minValue: "1900", maxValue: "1909" },
    });
    expect(person.columns.get("team")?.stats).toMatchObject({
      distinctCount: 4,
      mostCommonVals: ["0", "1", "2", "3"],
      mostCommonFreqs: [0.3, 0.3, 0.2, 0.2],
    });
  });

  it("reads a multi-valued property's table as one, joined to its source by the key the catalog names", async () => {
    const corpus = await attach();
    const { properties, vertices } = await readCatalog(corpus.coordinator, corpus.from);
    expect(properties.map((p) => [p.name, p.label, p.source, p.sourceKey, p.rows, [...p.columns.keys()]])).toEqual([
      ["Person_nickname", "nickname", "Person", "src", 10, ["src", "nickname"]],
    ]);
    expect(vertices.map((v) => v.name)).not.toContain("Person_nickname");
  });

  it("reads a corpus whose writer counted nothing as one with no counts", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `CREATE OR REPLACE VIEW ${corpus.from}.fossil_stats AS
         SELECT table_name, column_name, NULL::UBIGINT AS null_count, NULL::UBIGINT AS distinct_count, NULL::VARCHAR AS min_value,
           NULL::VARCHAR AS max_value, NULL::VARCHAR[] AS most_common_vals, NULL::DOUBLE[] AS most_common_freqs
         FROM ${corpus.from}.fossil_columns;`,
    );
    const { vertices } = await readCatalog(corpus.coordinator, corpus.from);
    expect(vertices.every((v) => [...v.columns.values()].every((c) => c.stats === null))).toBe(true);
  });
});
