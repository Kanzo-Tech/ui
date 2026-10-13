import { describe, expect, it } from "vitest";
import { asTableRef } from "@uwdata/mosaic-sql";
import { relationKey, type JoinGraph, type Relation } from "./relation.js";
import { resolveRelation } from "./resolve.js";

const at = (table: string) => asTableRef(["jobs/7", table])!;
const type = (name: string, columns: string[]) => ({ name, table: at(name), key: "id", columns });
const edge = (source: string, label: string, destination: string) => ({
  name: `${source}_${label}_${destination}`,
  label,
  source,
  destination,
  table: at(`${source}_${label}_${destination}`),
  src: "src",
  dst: "dst",
});

/** The Nobel example's graph, as keasy's Discover builds it from the corpus. */
const NOBEL: JoinGraph = {
  types: [
    type("LaureateAward", ["date", "share"]),
    type("Laureate", ["name", "gender"]),
    type("Category", ["name"]),
    type("University", ["name"]),
    type("Country", ["name"]),
  ],
  edges: [
    edge("LaureateAward", "laureate", "Laureate"),
    edge("LaureateAward", "category", "Category"),
    edge("LaureateAward", "university", "University"),
    edge("Laureate", "birthPlace", "Country"),
    edge("University", "addressCountry", "Country"),
  ],
};

const key = (relation: Relation) => relationKey(NOBEL, relation);

describe("resolveRelation", () => {
  it("is the type alone when the type is all the answer needs", () => {
    const resolved = resolveRelation(NOBEL, { root: "Laureate", types: ["Laureate"] });
    expect(resolved).toEqual({ kind: "relation", relation: { root: "Laureate", path: [] }, through: [] });
  });

  it("takes the hop to the type a field is on", () => {
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["University"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("LaureateAward>university>University");
  });

  it("keeps the page's filter in reach: prizes by university under a chip on the category relation", () => {
    // nobel-ask: the chip is published on LaureateAward>category>Category, so it crosses by the
    // prize's key, and the prize is this relation's root.
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["University"], under: ["LaureateAward"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("LaureateAward>university>University");
  });

  it("says a filter is out of reach before anything runs: universities alone, under a chip on the prizes", () => {
    // The failure the storyboard records — a small model counted the University type, which the
    // Physics chip cannot narrow, and read no rows. The relation that would answer it starts at the
    // prize; from the university it is one hop back, and the resolver finds it.
    const resolved = resolveRelation(NOBEL, { root: "University", types: ["University"], under: ["LaureateAward"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("University<university<LaureateAward");
  });

  it("hangs a filter off the step nearest it: the universities' prizes in Germany", () => {
    // The university's own country, one hop from the University step — not the prize's country,
    // which is two hops from the prize by either of two ways.
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["University"], filters: ["Country"], under: ["LaureateAward"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("LaureateAward>university>University");
    expect(resolved.kind === "relation" && resolved.through.map(key)).toEqual(["University>addressCountry>Country"]);
  });

  it("keeps a filter on the path when the path has its type", () => {
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["University", "Country"], filters: ["University"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("LaureateAward>university>University>addressCountry>Country");
    expect(resolved.kind === "relation" && resolved.through).toEqual([]);
  });

  it("asks rather than guesses when two paths are equally short: a prize's country", () => {
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["Country"] });
    expect(resolved.kind).toBe("ambiguous");
    expect(resolved.kind === "ambiguous" && resolved.options.map((o) => key(o.relation))).toEqual([
      "LaureateAward>laureate>Laureate>birthPlace>Country",
      "LaureateAward>university>University>addressCountry>Country",
    ]);
  });

  it("names what no relation within reach covers", () => {
    expect(resolveRelation(NOBEL, { root: "Country", types: ["Category"], maxHops: 2 })).toEqual({ kind: "unreachable", missing: ["Category"] });
    expect(resolveRelation(NOBEL, { root: "Country", filters: ["Category"], maxHops: 2 })).toEqual({ kind: "unreachable", missing: ["Category"] });
    expect(resolveRelation(NOBEL, { root: "Planet", types: [] })).toEqual({ kind: "unreachable", missing: ["Planet"] });
  });

  it("does not walk back along the edge it just took", () => {
    // Laureate → LaureateAward → Laureate is the row it came from; the self-join is never offered.
    const resolved = resolveRelation(NOBEL, { root: "Laureate", types: ["Category"] });
    expect(resolved.kind === "relation" && key(resolved.relation)).toBe("Laureate<laureate<LaureateAward>category>Category");
  });

  it("crosses a union type by the types it holds", () => {
    const graph: JoinGraph = { ...NOBEL, types: [...NOBEL.types, { ...type("Vertex", []), of: ["Laureate", "University"] }] };
    const resolved = resolveRelation(graph, { root: "LaureateAward", types: [], under: ["Vertex"], maxHops: 1 });
    expect(resolved.kind).toBe("ambiguous");
  });

  it("asks which branch when a filter is equally near two ways: prizes by category, in Germany", () => {
    const resolved = resolveRelation(NOBEL, { root: "LaureateAward", types: ["Category"], filters: ["Country"] });
    expect(resolved.kind === "ambiguous" && resolved.options.map((o) => o.through.map(key))).toEqual([
      ["LaureateAward>laureate>Laureate>birthPlace>Country"],
      ["LaureateAward>university>University>addressCountry>Country"],
    ]);
  });
});

/** The Nobel corpus as keasy's assistant writes it: an award's university is through its affiliation. */
const AWARDS: JoinGraph = {
  types: [type("Award", ["year"]), type("Laureate", ["name"]), type("Category", ["name"]), type("Affiliation", ["name"]), type("University", ["name"])],
  edges: [
    edge("Award", "laureate", "Laureate"),
    edge("Award", "category", "Category"),
    edge("Award", "affiliation", "Affiliation"),
    edge("Affiliation", "university", "University"),
  ],
};

describe("resolveRelation, a star from the measured type", () => {
  const keyOf = (relation: Relation) => relationKey(AWARDS, relation);

  it("reads a filter off the path through a branch: Physics awards by university", () => {
    // Award→Category and Award→Affiliation→University are two branches from the award: no one path
    // has both, which is what was refused as "No relation from Award reaches University".
    const resolved = resolveRelation(AWARDS, { root: "Award", types: ["University"], filters: ["Category"] });
    expect(resolved.kind).toBe("relation");
    if (resolved.kind !== "relation") return;
    expect(keyOf(resolved.relation)).toBe("Award>affiliation>Affiliation>university>University");
    expect(resolved.through.map(keyOf)).toEqual(["Award>category>Category"]);
  });

  it("branches once per type, however many filters are on it, and not for the measured type", () => {
    const resolved = resolveRelation(AWARDS, { root: "Award", types: ["Laureate"], filters: ["Category", "Category", "Award", "University"] });
    expect(resolved.kind === "relation" && resolved.through.map(keyOf)).toEqual(["Award>category>Category", "Award>affiliation>Affiliation>university>University"]);
  });
});
