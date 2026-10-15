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
      subject: { kind: "column" },
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
    { id: "_:city", source: { kind: "table", name: "City" }, subject: { kind: "column" }, classes: [`${EX}City`], annotations: [{ subject: `${EX}City`, predicate: RDFS_LABEL, value: { termType: "BlankNode", value: "b0" } }], columns: [], relations: [] },
    { id: "_:other", source: { kind: "query", name: undefined }, subject: { kind: "column" }, classes: [`${EX}Ghost`], annotations: [], columns: [], relations: [] },
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

// fossil's own output for `docs/programs/labels` (crates/fossil-df/tests/mapping.rs, the golden), as rudof's
// `Mapping.model()` reads it: a relation and a language-tagged set are triples maps over a query.
describe("withMapping over the maps fossil writes from a query", () => {
  const NOBEL = "https://nobel.example/vocab/";
  const SCHEMA = "https://schema.org/";
  const XSD = "http://www.w3.org/2001/XMLSchema#";
  const en = (subject: string, value: string) => label(subject, value, "en");
  const query = (sql: string) => ({ kind: "query", sql });
  const model: MappingModel = {
    tables: [
      {
        id: "#Person",
        source: { kind: "table", name: "Person" },
        subject: { kind: "column" },
        classes: [`${SCHEMA}Person`],
        annotations: [en(`${SCHEMA}Person`, "Nobel laureate"), label(`${SCHEMA}Person`, "galardonado con el Nobel", "es")],
        columns: [{ predicate: `${SCHEMA}birthDate`, value: { kind: "column", name: "birthDate" }, termType: "Literal", datatype: `${XSD}date`, annotations: [en(`${SCHEMA}birthDate`, "birth date"), label(`${SCHEMA}birthDate`, "fecha de nacimiento", "es")] }],
        relations: [],
      },
      {
        id: "#Person_awarded_Prize",
        source: query('SELECT s.subject AS source, d.subject AS target FROM "Person_awarded_Prize" AS e JOIN "Person" AS s ON e._graphArSrcIndex = s._graphArVertexIndex JOIN "Prize" AS d ON e._graphArDstIndex = d._graphArVertexIndex'),
        subject: { kind: "column" },
        classes: [],
        annotations: [],
        columns: [{ predicate: `${NOBEL}awarded`, value: { kind: "column", name: "target" }, termType: "IRI", annotations: [en(`${NOBEL}awarded`, "awarded")] }],
        relations: [],
      },
      {
        id: "#Person_name",
        source: query('SELECT subject, n.value AS value, n.lang AS lang FROM (SELECT subject, unnest("name") AS n FROM "Person")'),
        subject: { kind: "column" },
        classes: [],
        annotations: [],
        columns: [{ predicate: `${SCHEMA}name`, value: { kind: "column", name: "value" }, termType: "Literal", annotations: [en(`${SCHEMA}name`, "name")] }],
        relations: [],
      },
      { id: "#Prize", source: { kind: "table", name: "Prize" }, subject: { kind: "column" }, classes: [`${NOBEL}Prize`], annotations: [], columns: [{ predicate: `${NOBEL}category`, value: { kind: "column", name: "category" }, termType: "Literal", datatype: `${XSD}string`, annotations: [] }], relations: [] },
      {
        id: "#Prize_motivation",
        source: query('SELECT subject, n.value AS value, n.lang AS lang FROM (SELECT subject, unnest("motivation") AS n FROM "Prize")'),
        subject: { kind: "column" },
        classes: [],
        annotations: [],
        columns: [{ predicate: `${NOBEL}motivation`, value: { kind: "column", name: "value" }, termType: "Literal", annotations: [en(`${NOBEL}motivation`, "motivation")] }],
        relations: [],
      },
    ],
  };
  const graph: JoinGraph = {
    types: [
      { name: "Person", table: "p", key: "dense_id", columns: [{ name: "dense_id", type: "UBIGINT" }, { name: "subject", type: "VARCHAR" }, { name: "birthDate", type: "DATE" }, { name: "name", type: "STRUCT(value VARCHAR, lang VARCHAR)[]" }] },
      { name: "Prize", table: "z", key: "dense_id", columns: [{ name: "dense_id", type: "UBIGINT" }, { name: "subject", type: "VARCHAR" }, { name: "category", type: "VARCHAR" }, { name: "motivation", type: "STRUCT(value VARCHAR, lang VARCHAR)[]" }] },
    ],
    edges: [{ name: "Person_awarded_Prize", label: "awarded", source: "Person", destination: "Prize", table: "e", src: "src", dst: "dst" }],
  };
  const described = withMapping(graph, model);

  it("labels the edge a relation's query joins, by the edge table the SQL names", () => {
    expect(described.edges[0]).toMatchObject({ iri: `${NOBEL}awarded` });
    expect(edgeWords(described.edges[0]!, "en")).toBe("awarded");
  });

  it("describes the list a query unnests onto its type's one column the SQL names", () => {
    const columns = (type: string) => described.types.find((t) => t.name === type)!.columns;
    expect(columns("Person").find((c) => c.name === "name")).toMatchObject({ iri: `${SCHEMA}name`, termType: "Literal" });
    expect(columns("Prize").find((c) => c.name === "motivation")).toMatchObject({ iri: `${NOBEL}motivation` });
    expect(relationColumns(described, "Prize", "en").find((c) => c.name === "motivation")?.label).toBe("motivation");
    // A relation's query describes no column, and the table-sourced maps still do.
    expect(columns("Person").find((c) => c.name === "subject")).toEqual(graph.types[0]!.columns[1]);
    expect(columns("Person").find((c) => c.name === "birthDate")).toMatchObject({ datatype: `${XSD}date` });
    expect(typeWords(described, "Person", "es")).toBe("galardonado con el Nobel");
  });

  it("describes nothing a query names ambiguously", () => {
    const twice: JoinGraph = { ...graph, edges: [graph.edges[0]!, { ...graph.edges[0]!, label: "again" }] }; // two edges one SQL names
    expect(withMapping(twice, model).edges.map((e) => e.iri)).toEqual([undefined, undefined]);
    const none = withMapping({ ...graph, types: graph.types.map((t) => ({ ...t, name: `${t.name}2` })), edges: [] }, model);
    expect(none.types.flatMap((t) => t.columns).filter((c) => c.iri !== undefined)).toEqual([]);
  });
});
