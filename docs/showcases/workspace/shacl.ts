import { Parser, type Quad } from "n3";
import {
  and,
  column,
  eq,
  gt,
  isIn,
  isNull,
  literal,
  lt,
  not,
  or,
  regexp_matches,
  sql,
  type ExprNode,
} from "@uwdata/mosaic-sql";

/**
 * SHACL → SQL, for the subset that a column-shaped relation can answer.
 *
 * A shape constraint and a SQL predicate are the same statement in two notations, provided you know
 * which column a property path lands on. That mapping is the one thing SHACL cannot tell you, so it
 * arrives as a {@link Binding} argument rather than living here: `dcat:keyword` is a `|`-joined
 * column, `dcat:distribution` is a count, `dct:issued` is a DATE. Point the same shapes file at
 * another relation by passing another binding — {@link FOSSIL_BINDING} is simply the one this
 * showcase loads. Everything else falls out.
 *
 * The predicates are expression nodes, never strings. Values come out of somebody's shapes file,
 * and a compiler that builds SQL by concatenation owns every quote, every escape and every type by
 * hand — which is where a `DATE` column compared to `''` came from. It also quotes identifiers,
 * so a column called `order` does not take the report down with it.
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
  /** The predicate identifying the nodes that FAIL the constraint. */
  failing: ExprNode;
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
export interface ColumnBinding {
  column: string;
  kind: "scalar" | "multi" | "count";
  /**
   * How the column stores its values. It decides two things that a `kind` alone cannot: the
   * literal syntax, and what counts as absent — only text can be blank as well as null.
   *
   * @default "text"
   */
  datatype?: "text" | "date" | "number";
}

/**
 * Everything the compiler would otherwise have to invent.
 *
 * SHACL says nothing about columns, so something has to say which column a property path lands on
 * and which rows a target class selects. Taking it as an argument is what makes this a SHACL
 * compiler rather than a compiler for one particular table: point it at another relation and the
 * same shapes file compiles against that.
 */
export interface Binding {
  /** Property path CURIE → the column it lands on. */
  paths: Record<string, ColumnBinding>;
  /** Target class CURIE → the value that selects those rows. */
  targets: Record<string, string>;
  /** The column carrying the target class. */
  discriminator: string;
  /** Namespace IRI → prefix, for reading a shapes file back in its own notation. */
  prefixes: Record<string, string>;
}

/** The binding for the fossil node relation the workspace showcase loads. */
export const FOSSIL_BINDING: Binding = {
  discriminator: "kind",
  paths: {
    "dct:issued": { column: "issued", kind: "scalar", datatype: "date" },
    "dct:publisher": { column: "publisher", kind: "scalar" },
    "dcat:theme": { column: "theme", kind: "scalar" },
    "dct:format": { column: "label", kind: "scalar" },
    "dcat:keyword": { column: "keywords", kind: "multi" },
    "dcat:distribution": { column: "distributions", kind: "count", datatype: "number" },
    "kanzo:degree": { column: "degree", kind: "scalar", datatype: "number" },
  },
  targets: {
    "dcat:Dataset": "dataset",
    "dcat:Distribution": "distribution",
    "dcat:Resource": "dataset",
    "dcat:keyword": "keyword",
    "skos:Concept": "keyword",
    "foaf:Agent": "entity",
  },
  prefixes: {
    "http://www.w3.org/ns/dcat#": "dcat",
    "http://purl.org/dc/terms/": "dct",
    "http://xmlns.com/foaf/0.1/": "foaf",
    "http://www.w3.org/2004/02/skos/core#": "skos",
    "http://www.w3.org/ns/shacl#": "sh",
    "https://kanzo.tech/ns#": "kanzo",
  },
};

/** An IRI as the CURIE a shapes file would have written. */
export function curie(iri: string, prefixes = FOSSIL_BINDING.prefixes): string {
  for (const [namespace, prefix] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace)) return `${prefix}:${iri.slice(namespace.length)}`;
  }
  return iri;
}

const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value);

/**
 * Whether the path has no value at all.
 *
 * The blank test is only valid on text. DuckDB does not read `issued = ''` as false on a DATE
 * column, it reads it as a conversion error — and one such clause fails the whole report, since
 * every shape's count rides in a single query. That is what an `sh:minCount` on `dct:issued` used
 * to do: blank every number in the panel.
 */
function absent(binding: ColumnBinding): ExprNode {
  const col = column(binding.column);
  return (binding.datatype ?? "text") === "text"
    ? or(isNull(col), eq(col, literal("")))
    : isNull(col);
}

/** How many values the path has, per node. */
function cardinality(binding: ColumnBinding): ExprNode {
  const col = column(binding.column);
  if (binding.kind === "count") return col;
  if (binding.kind === "multi") {
    return sql`CASE WHEN ${absent(binding)} THEN 0 ELSE len(string_split(${col}, '|')) END`;
  }
  return sql`CASE WHEN ${absent(binding)} THEN 0 ELSE 1 END`;
}

/** A constraint value as the literal its column expects. */
function valueOf(binding: ColumnBinding, value: string): ExprNode {
  if (binding.datatype === "date") return sql`DATE ${literal(value)}`;
  return literal(isNumeric(value) ? Number(value) : value);
}

interface Constraint {
  kind: string;
  value: string | string[];
}

/** Walk an RDF collection — `sh:in ( "a" "b" )` — into its members. */
export function listMembers(quads: Quad[], head: string): string[] {
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

/**
 * The predicate that identifies nodes FAILING one constraint on one path.
 *
 * Expression nodes, not a string. The values reaching here come out of somebody's shapes file, and
 * a compiler that builds SQL by concatenation has to get every quote, every escape and every type
 * right by hand — which is exactly where `issued = ''` came from. `literal()` knows what a value
 * is; `column()` knows what an identifier is.
 */
function failingExpr(
  binding: Binding,
  selects: string,
  path: string,
  constraint: Constraint,
): ExprNode | null {
  const col = binding.paths[path];
  if (!col) return null;
  const isTarget = eq(column(binding.discriminator), literal(selects));
  const value = String(constraint.value);

  switch (constraint.kind) {
    case "minCount":
      // A cardinality compares against a number or against nothing at all.
      return isNumeric(value)
        ? and(isTarget, lt(cardinality(col), literal(Number(value))))
        : null;
    case "maxCount":
      return isNumeric(value)
        ? and(isTarget, gt(cardinality(col), literal(Number(value))))
        : null;
    case "minInclusive":
      return and(isTarget, lt(column(col.column), valueOf(col, value)));
    case "maxInclusive":
      return and(isTarget, gt(column(col.column), valueOf(col, value)));
    case "pattern":
      return and(isTarget, not(regexp_matches(column(col.column), literal(value))));
    case "in":
      return and(
        isTarget,
        not(isIn(column(col.column), (constraint.value as string[]).map((v) => literal(v)))),
      );
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
export function compileShacl(turtle: string, binding: Binding = FOSSIL_BINDING): CompileResult {
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
    .map((q) => ({ shape: q.subject.value, target: curie(q.object.value, binding.prefixes) }));

  if (nodeShapes.length === 0) {
    errors.push("No sh:NodeShape with an sh:targetClass — nothing to validate against.");
  }

  for (const { shape, target } of nodeShapes) {
    const kind = binding.targets[target];
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
      const path = curie(pathNode.value, binding.prefixes);
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
        const failing = failingExpr(binding, kind, path, constraint);
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
      if (compiled === 0 && binding.paths[path] === undefined) {
        unsupported.push(`${path} — no column is mapped to this property path`);
      }
    }
  }

  return { shapes, unsupported, errors };
}

/**
 * How a path stores its values, for a caller that has to pick a CONTROL for one.
 *
 * The builder needs this for the same reason the compiler does: a date is not a number is not a
 * string, and guessing from the value is how you end up with `DATE ''`.
 */
export function pathDatatype(
  path: string,
  binding: Binding = FOSSIL_BINDING,
): "text" | "date" | "number" | undefined {
  const col = binding.paths[path];
  return col && (col.datatype ?? "text");
}

/** What a shapes file may talk about, for a panel that has to offer the choice. */
export const SUPPORTED_PATHS = Object.keys(FOSSIL_BINDING.paths);
export const SUPPORTED_TARGETS = Object.keys(FOSSIL_BINDING.targets);

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
