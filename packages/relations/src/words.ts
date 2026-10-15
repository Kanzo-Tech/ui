import type { JoinAnnotation, JoinEdge, JoinGraph, JoinType } from "./relation.js";

/**
 * **A thing's words are its labels** (`/docs/design/fields`, *The words are its labels*). A type, an
 * edge and a column are called what their `rdfs:label` says in the page's language — fossil writes a
 * SHACL shape's `sh:name` as `rdfs:label`, so a reader asks that one predicate — and a type is named
 * in a row by the column whose property is a labelling property. The code supplies no word of its
 * own; where nothing labels a name, the identifier split is the last resort, and it never inflects.
 */

const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const RDFS_LABEL = `${RDFS}label`;

/**
 * The labelling properties, preferred in rdflib's order — `skos:prefLabel`, then `rdfs:label` — then
 * the sub-properties of `rdfs:label` their own vocabularies declare: schema.org's `name` (both
 * schemes) and FOAF's `name`.
 */
const PREFERRED = ["http://www.w3.org/2004/02/skos/core#prefLabel", RDFS_LABEL];
const SUB_PROPERTIES = new Set(["http://schema.org/name", "https://schema.org/name", "http://xmlns.com/foaf/0.1/name"]);

/** The page's language, `<html lang>`, where there is a page. */
const pageLanguage = (): string => (typeof document === "undefined" ? "" : document.documentElement.lang);

/**
 * **What a type, an edge or a column is called in `language`** — the page's by default: its
 * `rdfs:label` there by RFC 4647 §3.4's lookup (`es-AR`, then `es`), then an untagged one, as
 * Wikidata's label service falls back through its list; on a page that names no language, its first.
 * `undefined` where nothing labels it.
 */
export function labelOf(annotations: readonly JoinAnnotation[] | undefined, language: string = pageLanguage()): string | undefined {
  const labels = (annotations ?? []).flatMap((a) => (a.predicate === RDFS_LABEL && typeof a.object !== "string" ? [a.object] : []));
  const tags = language.toLowerCase().split("-").filter(Boolean);
  for (let n = tags.length; n > 0; n--) {
    const tag = tags.slice(0, n).join("-");
    const found = labels.find((l) => l.language?.toLowerCase() === tag);
    if (found) return found.value;
  }
  return (labels.find((l) => l.language === undefined) ?? (tags.length === 0 ? labels[0] : undefined))?.value;
}

/**
 * A type's naming column: the column whose property IRI is a labelling property — never a column
 * because it is called `name` — or `undefined` for a type with none, whose row is read by its
 * identity's local name.
 */
export function namingColumn(type: Pick<JoinType, "columns">): string | undefined {
  for (const iri of PREFERRED) {
    const found = type.columns.find((c) => c.iri === iri);
    if (found) return found.name;
  }
  return type.columns.find((c) => c.iri !== undefined && SUB_PROPERTIES.has(c.iri))?.name;
}

/**
 * A name as words, where nothing labels it — the last resort, and it never inflects:
 * `isLocatedIn` → `is located in`, `TagClass` → `tag class`; an acronym keeps its case.
 */
export const splitWords = (name: string): string =>
  name
    .split(/(?<=[a-z0-9])(?=[A-Z])|[_\s]+/)
    .filter(Boolean)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(" ");

/** What a type is called, in `language`: its label, else its name in words. */
export const typeWords = (graph: Pick<JoinGraph, "types">, name: string, language?: string): string =>
  labelOf(graph.types.find((t) => t.name === name)?.annotations, language) ?? splitWords(name);

/** What an edge is called, in `language`: its label, else its `label` in words. */
export const edgeWords = (edge: Pick<JoinEdge, "label" | "annotations">, language?: string): string =>
  labelOf(edge.annotations, language) ?? splitWords(edge.label);
