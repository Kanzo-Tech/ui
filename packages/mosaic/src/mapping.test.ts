import { describe, expect, it } from "vitest";
import { withMapping, type MappingModel } from "./mapping.js";
import { relationColumns, type JoinGraph } from "./relation.js";
import { edgeWords, typeWords } from "./words.js";

const EX = "https://example.org/";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const label = (subject: string, value: string, language: string) => ({ subject, predicate: RDFS_LABEL, value: { termType: "Literal", value, language } });

// What GraphAr states: tables, column types, edges. No IRI, no word.
const GRAPH: JoinGraph = {
  types: [
    { name: "Person", table: "person", key: "dense_id", columns: [{ name: "dense_id", type: "UBIGINT" }, { name: "name", type: "VARCHAR" }, { name: "born", type: "INTEGER" }] },
    { name: "City", table: "city", key: "dense_id", columns: [{ name: "dense_id", type: "UBIGINT" }, { name: "name", type: "VARCHAR" }] },
    { name: "vertices", table: "v", key: "dense_id", of: ["Person", "City"], columns: [{ name: "dense_id", type: "UBIGINT" }, { name: "name", type: "VARCHAR" }] },
  ],
  edges: [
    { name: "Person_birthPlace_City", label: "birthPlace", source: "Person", destination: "City", table: "e1", src: "src", dst: "dst" },
    { name: "Person_deathPlace_City", label: "deathPlace", source: "Person", destination: "City", table: "e2", src: "src", dst: "dst" },
  ],
};

// What rudof's `Mapping.model()` answers for it, cut to what is read.
const MODEL: MappingModel = {
  tables: [
    {
      id: "_:person",
      source: { kind: "table", name: "Person" },
      classes: [`${EX}Person`],
      annotations: [label(`${EX}Person`, "Person", "en"), label(`${EX}Person`, "Persona", "es")],
      columns: [
        { predicate: `${EX}name`, value: { kind: "column", name: "name" }, termType: "Literal", datatype: "http://www.w3.org/2001/XMLSchema#string", annotations: [label(`${EX}name`, "name", "en")] },
        { predicate: `${EX}born`, value: { kind: "column", name: "born" }, termType: "Literal", datatype: "http://www.w3.org/2001/XMLSchema#gYear", annotations: [] },
        { predicate: `${EX}age`, value: { kind: "template", name: undefined }, termType: "Literal", annotations: [] },
      ],
      relations: [
        { predicate: `${EX}deathPlace`, parent: "_:city", annotations: [label(`${EX}deathPlace`, "place of death", "en")] },
        { predicate: `${EX}birthPlace`, parent: "_:city", annotations: [] },
      ],
    },
    { id: "_:city", source: { kind: "table", name: "City" }, classes: [`${EX}City`], annotations: [{ subject: `${EX}City`, predicate: RDFS_LABEL, value: { termType: "BlankNode", value: "b0" } }], columns: [], relations: [] },
    { id: "_:other", source: { kind: "query", name: undefined }, classes: [`${EX}Ghost`], annotations: [], columns: [], relations: [] },
  ],
};

describe("withMapping", () => {
  const described = withMapping(GRAPH, MODEL);
  const person = described.types.find((t) => t.name === "Person")!;

  it("puts the class, the predicates, the term types and the datatypes on the graph", () => {
    expect(person.iri).toBe(`${EX}Person`);
    expect(person.columns.find((c) => c.name === "born")).toMatchObject({ iri: `${EX}born`, termType: "Literal", datatype: "http://www.w3.org/2001/XMLSchema#gYear" });
    // A column the mapping reads from a template, and the key, are left as they were.
    expect(person.columns.find((c) => c.name === "dense_id")).toEqual(GRAPH.types[0]!.columns[0]);
  });

  it("keeps every language, and the reader chooses one: the same graph reads in either", () => {
    expect(typeWords(described, "Person", "es")).toBe("Persona");
    expect(typeWords(described, "Person", "en")).toBe("Person");
    expect(relationColumns(described, "Person", "en").find((c) => c.name === "name")?.label).toBe("name");
  });

  it("falls back to the name in words where the mapping labels nothing, and a blank node labels nothing", () => {
    expect(typeWords(described, "City", "en")).toBe("city");
    expect(typeWords(GRAPH, "Person", "en")).toBe("person");
    expect(edgeWords(described.edges[0]!, "en")).toBe("birth place");
  });

  it("describes an edge from the source's relation to the parent, the one its label names among several", () => {
    const [birth, death] = described.edges;
    expect(birth).toMatchObject({ iri: `${EX}birthPlace` });
    expect(death).toMatchObject({ iri: `${EX}deathPlace` });
    expect(edgeWords(death!, "en")).toBe("place of death");
  });

  it("describes a union by its members, and changes nothing the mapping does not name", () => {
    expect(described.types.find((t) => t.name === "vertices")!.columns.find((c) => c.name === "name")).toMatchObject({ iri: `${EX}name` });
    expect(withMapping(GRAPH, { tables: [MODEL.tables[2]!] })).toEqual(GRAPH);
    expect(GRAPH.types[0]!.iri).toBeUndefined();
  });
});
