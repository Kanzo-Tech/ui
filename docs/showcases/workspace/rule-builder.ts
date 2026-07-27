import { Parser, type Quad } from "n3";
import { curie, listMembers, type Severity } from "./shacl";

/**
 * The other direction of `./shacl`: a rule you can pick from menus, written out as Turtle.
 *
 * The builder holds no state the shapes file does not. A rule is parsed out of the document and
 * written back into it, so the panel keeps ONE source of truth — the Turtle — and everything
 * downstream (compile → counts → focus) runs on a document the user could equally have uploaded.
 * That is the whole claim: the thing you build is a shapes file, not a picture of one.
 */

const SH = "http://www.w3.org/ns/shacl#";

export const CONSTRAINT_KINDS = [
  "minCount",
  "maxCount",
  "minInclusive",
  "maxInclusive",
  "in",
  "pattern",
] as const;

export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

export interface Rule {
  id: string;
  /** The target class, as a CURIE: `dcat:Dataset`. */
  target: string;
  /** The property path, as a CURIE: `dcat:keyword`. */
  path: string;
  kind: ConstraintKind;
  /** The constraint value. For `in`, the members separated by commas. */
  value: string;
  severity: Severity;
}

export interface ParseResult {
  rules: Rule[];
  /**
   * Whether the rules are the WHOLE document. False when it holds something the builder cannot
   * write back — an unsupported constraint, a named property shape, a second shape on one target.
   * Regenerating then would drop it, so the panel refuses to edit rather than lose it silently.
   */
  exact: boolean;
  /** What made it inexact, in the document's own vocabulary. */
  lost: string[];
}

const SEVERITY_IRI: Record<Severity, string> = {
  violation: "sh:Violation",
  warning: "sh:Warning",
  info: "sh:Info",
};

const SEVERITY_OF: Record<string, Severity> = {
  [`${SH}Violation`]: "violation",
  [`${SH}Warning`]: "warning",
  [`${SH}Info`]: "info",
};

/** Prefixes a generated document declares — only the ones its CURIEs actually use. */
const NAMESPACES: Record<string, string> = {
  sh: "http://www.w3.org/ns/shacl#",
  dcat: "http://www.w3.org/ns/dcat#",
  dct: "http://purl.org/dc/terms/",
  foaf: "http://xmlns.com/foaf/0.1/",
  skos: "http://www.w3.org/2004/02/skos/core#",
  kanzo: "https://kanzo.tech/ns#",
};

const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value);

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A number stays bare, everything else is a quoted literal — what the default shapes write. */
function literal(value: string): string {
  return isNumeric(value) ? value : quote(value);
}

export function members(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** `dcat:Dataset` → `kanzo:DatasetShape`; the name the default shapes give that target. */
function shapeName(target: string): string {
  const local = target.slice(target.indexOf(":") + 1);
  return `kanzo:${local.charAt(0).toUpperCase()}${local.slice(1)}Shape`;
}

function prefixOf(curieText: string): string {
  return curieText.slice(0, curieText.indexOf(":"));
}

/** The rules as a shapes file: one `sh:NodeShape` per target, one `sh:property` per rule. */
export function toTurtle(rules: readonly Omit<Rule, "id">[]): string {
  const targets = [...new Set(rules.map((rule) => rule.target))];
  const used = new Set(["sh", "kanzo"]);
  for (const rule of rules) {
    used.add(prefixOf(rule.target));
    used.add(prefixOf(rule.path));
  }

  const header = Object.entries(NAMESPACES)
    .filter(([prefix]) => used.has(prefix))
    .map(([prefix, iri]) => `@prefix ${prefix}:${" ".repeat(Math.max(1, 6 - prefix.length))}<${iri}> .`)
    .join("\n");

  const blocks = targets.map((target) => {
    const properties = rules
      .filter((rule) => rule.target === target)
      .map((rule) => {
        const object =
          rule.kind === "in"
            ? `( ${members(rule.value).map(quote).join(" ")} )`
            : literal(rule.value);
        return [
          "  sh:property [",
          `    sh:path ${rule.path} ;`,
          `    sh:${rule.kind} ${object} ;`,
          `    sh:severity ${SEVERITY_IRI[rule.severity]} ;`,
          "  ]",
        ].join("\n");
      })
      .join(" ;\n");

    return `${shapeName(target)}\n  a sh:NodeShape ;\n  sh:targetClass ${target} ;\n${properties} .`;
  });

  return `${header}\n\n${blocks.join("\n\n")}\n`;
}

/**
 * Read a shapes file back into rules, and say whether that reading was lossless.
 *
 * Formatting and comments do not survive a round trip — the document is regenerated, not patched.
 * What must survive is MEANING, so anything carrying meaning the builder cannot re-emit makes the
 * result inexact and the panel read-only.
 */
export function parseRules(turtle: string): ParseResult {
  let quads: Quad[];
  try {
    quads = new Parser().parse(turtle) as Quad[];
  } catch (error) {
    return { rules: [], exact: false, lost: [String(error)] };
  }

  const rules: Rule[] = [];
  const lost: string[] = [];

  const objectOf = (subject: string, predicate: string) =>
    quads.find((q) => q.subject.value === subject && q.predicate.value === `${SH}${predicate}`)
      ?.object;

  const nodeShapes = quads
    .filter((q) => q.predicate.value === `${SH}targetClass`)
    .map((q) => ({ shape: q.subject.value, target: curie(q.object.value) }));

  const seenTargets = new Set<string>();
  for (const { shape, target } of nodeShapes) {
    // Two shapes on one target would collapse into one block on the way out.
    if (seenTargets.has(target)) lost.push(`a second sh:NodeShape targeting ${target}`);
    seenTargets.add(target);

    const properties = quads
      .filter((q) => q.subject.value === shape && q.predicate.value === `${SH}property`)
      .map((q) => q.object.value);

    for (const property of properties) {
      const pathNode = objectOf(property, "path");
      if (!pathNode) {
        lost.push(`${target} — a property shape with no sh:path`);
        continue;
      }
      const path = curie(pathNode.value);
      const severity = SEVERITY_OF[objectOf(property, "severity")?.value ?? ""] ?? "violation";

      for (const quad of quads.filter(
        (q) => q.subject.value === property && q.predicate.value.startsWith(SH),
      )) {
        const kind = quad.predicate.value.slice(SH.length);
        if (kind === "path" || kind === "severity") continue;
        if (!(CONSTRAINT_KINDS as readonly string[]).includes(kind)) {
          lost.push(`${path} sh:${kind}`);
          continue;
        }
        rules.push({
          id: `${shape}|${path}|${kind}`,
          target,
          path,
          kind: kind as ConstraintKind,
          value:
            kind === "in"
              ? listMembers(quads, quad.object.value).join(", ")
              : quad.object.value,
          severity,
        });
      }
    }
  }

  return { rules, exact: lost.length === 0, lost };
}

/** Whether a value is usable for this constraint — what the Add button waits for. */
export function isValidValue(kind: ConstraintKind, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (kind === "minCount" || kind === "maxCount") return /^\d+$/.test(trimmed);
  if (kind === "in") return members(trimmed).length > 0;
  if (kind === "pattern") {
    try {
      new RegExp(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}
