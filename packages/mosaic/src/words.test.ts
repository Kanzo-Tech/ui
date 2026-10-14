import { describe, expect, it } from "vitest";
import type { JoinAnnotation, JoinGraph } from "./relation.js";
import { relationColumns } from "./relation.js";
import { labelOf, namingColumn, splitWords } from "./words.js";

const LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const label = (value: string, language?: string): JoinAnnotation => ({ predicate: LABEL, object: { value, ...(language ? { language } : {}) } });

describe("labelOf", () => {
  const award = [label("award", "en"), label("premio", "es"), label("Preis")];

  it("reads the label in the page's language by RFC 4647's lookup, then an untagged one", () => {
    expect(labelOf(award, "es-AR")).toBe("premio");
    expect(labelOf(award, "en")).toBe("award");
    expect(labelOf(award, "fr")).toBe("Preis");
    expect(labelOf([label("award", "en")], "fr")).toBeUndefined();
    // A page that names no language reads the first.
    expect(labelOf([label("award", "en")], "")).toBe("award");
  });

  it("reads rdfs:label alone, and nothing from an IRI's object or another predicate", () => {
    expect(labelOf([{ predicate: "http://www.w3.org/2000/01/rdf-schema#comment", object: { value: "a prize" } }], "en")).toBeUndefined();
    expect(labelOf([{ predicate: LABEL, object: "https://example.org/award" }], "en")).toBeUndefined();
  });
});

describe("namingColumn", () => {
  it("is the column whose property labels, preferred as rdflib prefers, never one because it is called name", () => {
    const columns = [
      { name: "name", type: "VARCHAR" },
      { name: "title", type: "VARCHAR", iri: "https://schema.org/name" },
      { name: "pref", type: "VARCHAR", iri: "http://www.w3.org/2004/02/skos/core#prefLabel" },
    ];
    expect(namingColumn({ columns })).toBe("pref");
    expect(namingColumn({ columns: columns.slice(0, 2) })).toBe("title");
    expect(namingColumn({ columns: columns.slice(0, 1) })).toBeUndefined();
  });
});

describe("a column's words", () => {
  it("are its own label, or its type's for the type's naming column, and absent where nothing labels it", () => {
    const graph: JoinGraph = {
      types: [
        {
          name: "University",
          table: "university",
          key: "dense_id",
          annotations: [label("university", "en"), label("universidad", "es")],
          columns: [
            { name: "dense_id", type: "UBIGINT" },
            { name: "name", type: "VARCHAR", iri: "http://xmlns.com/foaf/0.1/name" },
            { name: "founded", type: "INTEGER", annotations: [label("founded in", "en")] },
            { name: "rank", type: "INTEGER" },
          ],
        },
      ],
      edges: [],
    };
    expect(relationColumns(graph, "University", "es").map((c) => [c.name, c.label])).toEqual([
      ["dense_id", undefined],
      ["name", "universidad"],
      ["founded", undefined],
      ["rank", undefined],
    ]);
    expect(relationColumns(graph, "University", "en").find((c) => c.name === "founded")?.label).toBe("founded in");
  });
});

describe("splitWords", () => {
  it("splits an identifier, and never inflects", () => {
    expect(splitWords("birthPlace")).toBe("birth place");
    expect(splitWords("hall_of_fame")).toBe("hall of fame");
    expect(splitWords("Person")).toBe("person");
  });
});
