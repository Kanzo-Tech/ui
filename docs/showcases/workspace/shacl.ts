import { Parser, type Quad } from "n3";

/**
 * SHACL → SQL, for the subset that a column-shaped relation can answer.
 *
 * A shape constraint and a SQL predicate are the same statement in two notations, provided you know
 * which column a property path lands on. That mapping is the only thing this compiler *invents*, and
 * it is declared below rather than guessed: `dcat:keyword` is a `|`-joined column, `dcat:distribution`
 * is a count, `dct:issued` is a DATE. Everything else falls out.
 *
 * **What is supported**, because it maps cleanly: `sh:targetClass`, `sh:path`, `sh:minCount`,
 * `sh:maxCount`, `sh:in`, `sh:minInclusive`, `sh:maxInclusive`, `sh:pattern`, `sh:severity`.
 *
 * **What is not**: `sh:and` / `sh:or` / `sh:not`, `sh:node`, `sh:qualifiedValueShape`, `sh:sparql`,
 * and any path that is not a single predicate. Those are reported by name as unsupported rather than
 * dropped — a validator that quietly ignores half a shapes file is worse than one that refuses it,
 * because you cannot tell the difference between "conforms" and "never checked".
 */

const SH = "http://www.w3.org/ns/shacl#";
const RDF_FIRST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#first";
const RDF_REST = "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest";
const RDF_NIL = "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil";

export type Severity = "violation" | "warning" | "info";

export interface Shape {
  id: string;
  /** The target class, as written: `dcat:Dataset`. */
  target: string;
  /** The constraint, as a reader of SHACL would write it. */
  constraint: string;
  severity: Severity;
  /** SQL identifying the nodes that FAIL the constraint. */
  failing: string;
}

export interface CompileResult {
  shapes: Shape[];
  /** Constraints recognised as SHACL but outside the supported subset. */
  unsupported: string[];
  errors: string[];
}

/**
 * How a property path lands on the node relation.
 *
 * `multi` means the column holds several values joined by `|`, so cardinality is a token count;
 * `count` means the column already *is* the cardinality.
 */
interface ColumnBinding {
  column: string;
  kind: "scalar" | "multi" | "count";
  /** Renders a SQL literal for a value in this column. */
  literal?: (value: string) => string;
}

const PATHS: Record<string, ColumnBinding> = {
  "dct:issued": { column: "issued", kind: "scalar", literal: (v) => `DATE '${v}'` },
  "dct:publisher": { column: "publisher", kind: "scalar" },
  "dcat:theme": { column: "theme", kind: "scalar" },
  "dct:format": { column: "label", kind: "scalar" },
  "dcat:keyword": { column: "keywords", kind: "multi" },
  "dcat:distribution": { column: "distributions", kind: "count" },
  "kanzo:degree": { column: "degree", kind: "scalar" },
};

/** Which `kind` value a target class selects. */
const TARGETS: Record<string, string> = {
  "dcat:Dataset": "dataset",
  "dcat:Distribution": "distribution",
  "dcat:Resource": "dataset",
  "dcat:keyword": "keyword",
  "skos:Concept": "keyword",
  "foaf:Agent": "entity",
};

const PREFIXES: Record<string, string> = {
  "http://www.w3.org/ns/dcat#": "dcat",
  "http://purl.org/dc/terms/": "dct",
  "http://xmlns.com/foaf/0.1/": "foaf",
  "http://www.w3.org/2004/02/skos/core#": "skos",
  "http://www.w3.org/ns/shacl#": "sh",
  "https://kanzo.tech/ns#": "kanzo",
};

/** An IRI as the CURIE a shapes file would have written. */
function curie(iri: string): string {
  for (const [namespace, prefix] of Object.entries(PREFIXES)) {
    if (iri.startsWith(namespace)) return `${prefix}:${iri.slice(namespace.length)}`;
  }
  return iri;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** The number of `|`-joined tokens in a column, as DuckDB counts them. */
function tokenCount(column: string): string {
  return `CASE WHEN ${column} IS NULL OR ${column} = '' THEN 0 ELSE len(string_split(${column}, '|')) END`;
}

/** How many values the path has, per node. */
function cardinality(binding: ColumnBinding): string {
  if (binding.kind === "count") return binding.column;
  if (binding.kind === "multi") return tokenCount(binding.column);
  return `CASE WHEN ${binding.column} IS NULL OR ${binding.column} = '' THEN 0 ELSE 1 END`;
}

interface Constraint {
  kind: string;
  value: string | string[];
}

/** Walk an RDF collection — `sh:in ( "a" "b" )` — into its members. */
function listMembers(quads: Quad[], head: string): string[] {
  const out: string[] = [];
  let node = head;
  const seen = new Set<string>();
  while (node && node !== RDF_NIL && !seen.has(node)) {
    seen.add(node);
    const first = quads.find((q) => q.subject.value === node && q.predicate.value === RDF_FIRST);
    const rest = quads.find((q) => q.subject.value === node && q.predicate.value === RDF_REST);
    if (first) out.push(first.object.value);
    node = rest?.object.value ?? "";
  }
  return out;
}

const SEVERITIES: Record<string, Severity> = {
  [`${SH}Violation`]: "violation",
  [`${SH}Warning`]: "warning",
  [`${SH}Info`]: "info",
};

const SUPPORTED = new Set([
  "minCount", "maxCount", "in", "minInclusive", "maxInclusive", "pattern",
]);

/** Constraint kinds we recognise as SHACL and deliberately do not compile. */
const KNOWN_UNSUPPORTED = new Set([
  "and", "or", "not", "xone", "node", "qualifiedValueShape", "sparql", "closed",
  "lessThan", "lessThanOrEquals", "disjoint", "equals", "hasValue", "languageIn", "uniqueLang",
  "nodeKind", "datatype", "class", "minLength", "maxLength", "minExclusive", "maxExclusive",
]);

/** The SQL that identifies nodes failing one constraint on one path. */
function failingSql(target: string, path: string, constraint: Constraint): string | null {
  const binding = PATHS[path];
  if (!binding) return null;
  const kindFilter = `kind = ${sqlString(target)}`;
  const column = binding.column;
  // A bare number must not be quoted: `degree < '2'` compares an int to a string.
  const literal =
    binding.literal ?? ((v: string) => (/^-?\d+(\.\d+)?$/.test(v) ? v : sqlString(v)));

  switch (constraint.kind) {
    case "minCount":
      return `${kindFilter} AND ${cardinality(binding)} < ${constraint.value}`;
    case "maxCount":
      return `${kindFilter} AND ${cardinality(binding)} > ${constraint.value}`;
    case "minInclusive":
      return `${kindFilter} AND ${column} < ${literal(String(constraint.value))}`;
    case "maxInclusive":
      return `${kindFilter} AND ${column} > ${literal(String(constraint.value))}`;
    case "pattern":
      return `${kindFilter} AND NOT regexp_matches(${column}, ${sqlString(String(constraint.value))})`;
    case "in": {
      const values = (constraint.value as string[]).map((v) => sqlString(v)).join(", ");
      return `${kindFilter} AND ${column} NOT IN (${values})`;
    }
    default:
      return null;
  }
}

/** The constraint, in the notation a SHACL reader expects. */
function constraintText(path: string, constraint: Constraint): string {
  if (constraint.kind === "in") {
    return `${path} in (${(constraint.value as string[]).join(", ")})`;
  }
  const operators: Record<string, string> = {
    minCount: "minCount",
    maxCount: "maxCount",
    minInclusive: ">=",
    maxInclusive: "<=",
    pattern: "matches",
  };
  return `${path} ${operators[constraint.kind] ?? constraint.kind} ${constraint.value}`;
}

/** Parse a SHACL shapes graph in Turtle and compile what it can into SQL predicates. */
export function compileShacl(turtle: string): CompileResult {
  const shapes: Shape[] = [];
  const unsupported: string[] = [];
  const errors: string[] = [];

  let quads: Quad[];
  try {
    quads = new Parser().parse(turtle) as Quad[];
  } catch (error) {
    return { shapes, unsupported, errors: [String(error)] };
  }

  const objectOf = (subject: string, predicate: string) =>
    quads.find((q) => q.subject.value === subject && q.predicate.value === `${SH}${predicate}`)
      ?.object;

  const nodeShapes = quads
    .filter((q) => q.predicate.value === `${SH}targetClass`)
    .map((q) => ({ shape: q.subject.value, target: curie(q.object.value) }));

  if (nodeShapes.length === 0) {
    errors.push("No sh:NodeShape with an sh:targetClass — nothing to validate against.");
  }

  for (const { shape, target } of nodeShapes) {
    const kind = TARGETS[target];
    if (!kind) {
      unsupported.push(`${target} — no relation is mapped to this target class`);
      continue;
    }

    const properties = quads
      .filter((q) => q.subject.value === shape && q.predicate.value === `${SH}property`)
      .map((q) => q.object.value);

    for (const property of properties) {
      const pathNode = objectOf(property, "path");
      if (!pathNode) {
        unsupported.push(`${target} — a property shape with no sh:path (or a path expression)`);
        continue;
      }
      const path = curie(pathNode.value);
      const severity = SEVERITIES[objectOf(property, "severity")?.value ?? ""] ?? "violation";

      const constraints = quads.filter(
        (q) => q.subject.value === property && q.predicate.value.startsWith(SH),
      );

      let compiled = 0;
      for (const quad of constraints) {
        const kindName = quad.predicate.value.slice(SH.length);
        if (kindName === "path" || kindName === "severity" || kindName === "name" || kindName === "description") {
          continue;
        }
        if (!SUPPORTED.has(kindName)) {
          if (KNOWN_UNSUPPORTED.has(kindName)) {
            unsupported.push(`${path} sh:${kindName} — outside the supported subset`);
          }
          continue;
        }

        const value: string | string[] =
          kindName === "in" ? listMembers(quads, quad.object.value) : quad.object.value;
        const constraint: Constraint = { kind: kindName, value };
        const failing = failingSql(kind, path, constraint);
        if (!failing) {
          unsupported.push(`${path} — no column is mapped to this property path`);
          continue;
        }
        compiled++;
        shapes.push({
          id: `${shape}|${path}|${kindName}`,
          target,
          constraint: constraintText(path, constraint),
          severity,
          failing,
        });
      }
      if (compiled === 0 && PATHS[path] === undefined) {
        unsupported.push(`${path} — no column is mapped to this property path`);
      }
    }
  }

  return { shapes, unsupported, errors };
}

/** The mapped property paths, for the panel to show what a shapes file may talk about. */
export const SUPPORTED_PATHS = Object.keys(PATHS);
export const SUPPORTED_TARGETS = Object.keys(TARGETS);

/**
 * The shapes the panel opens with — a real Turtle document, not a JS array dressed up as one, so
 * "conforms" and "violates" are answers to the same file a user could have uploaded.
 */
export const DEFAULT_SHAPES = `@prefix sh:   <http://www.w3.org/ns/shacl#> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix dct:  <http://purl.org/dc/terms/> .
@prefix kanzo: <https://kanzo.tech/ns#> .

kanzo:DatasetShape
  a sh:NodeShape ;
  sh:targetClass dcat:Dataset ;
  sh:property [
    sh:path dct:issued ;
    sh:minInclusive "2020-01-01" ;
    sh:severity sh:Violation ;
  ] ;
  sh:property [
    sh:path dct:publisher ;
    sh:minCount 1 ;
    sh:severity sh:Violation ;
  ] ;
  sh:property [
    sh:path dcat:keyword ;
    sh:minCount 3 ;
    sh:severity sh:Warning ;
  ] ;
  sh:property [
    sh:path dcat:distribution ;
    sh:minCount 2 ;
    sh:severity sh:Warning ;
  ] .

kanzo:DistributionShape
  a sh:NodeShape ;
  sh:targetClass dcat:Distribution ;
  sh:property [
    sh:path dct:format ;
    sh:in ( "parquet" "csv" "graphar" ) ;
    sh:severity sh:Violation ;
  ] .

kanzo:KeywordShape
  a sh:NodeShape ;
  sh:targetClass dcat:keyword ;
  sh:property [
    sh:path kanzo:degree ;
    sh:minInclusive 2 ;
    sh:severity sh:Warning ;
  ] .
`;
