import { LINKS, SOURCES, type Source } from "./data";
import type { Question } from "./tasks";

/** One property of a type as the Model screen draws it: where its value comes from, and who needs it. */
export interface Property {
  name: string;
  kind: "text" | "number" | "date" | "link";
  /** The type a link points at. */
  to?: string;
  /** The questions that stand on it. */
  neededBy: string[];
}

export interface Shape {
  type: string;
  source: Source;
  properties: Property[];
}

/**
 * The model the questions ask for, computed rather than asked of a model: every type a question
 * reaches, and every one of its columns, each marked with the questions that need it. A column no
 * question needs is still offered — off — so the person can take it anyway.
 */
export function modelOf(questions: readonly Question[]): Shape[] {
  const reached = new Set<string>();
  for (const q of questions)
    for (const concept of q.uses) {
      const [from, to] = concept.split("→");
      reached.add(from!.split(".")[0]!);
      if (to) reached.add(to);
    }
  return SOURCES.filter((s) => reached.has(s.type)).map((source) => ({
    type: source.type,
    source,
    properties: source.columns
      .filter((c) => c.name !== source.key)
      .map((c) => {
        const link = LINKS.find((l) => l.from === source.type && l.column === c.name);
        const concept = link ? `${link.from}→${link.to}` : `${source.type}.${c.name}`;
        return {
          name: c.name,
          kind: link ? "link" : c.kind,
          to: link?.to,
          neededBy: questions.filter((q) => q.uses.includes(concept)).map((q) => q.question),
        };
      }),
  }));
}

const plural: Record<string, string> = { Award: "Awards", Laureate: "Laureates", Institution: "Institutions" };
const parse: Partial<Record<Property["kind"], string>> = { number: "parse.integer", date: "parse.date" };

/**
 * The mapping the model is built by, in Fossil — what the mapping Task writes under the grammar of
 * these names, shown only behind "Advanced". `on` is the properties the person kept.
 */
export function fossilOf(shapes: readonly Shape[], on: ReadonlySet<string>): string {
  const types = shapes.map((s) => s.type).join(", ");
  const rows = shapes.map((s) => `${s.type}Row`);
  const width = Math.max(...rows.map((r) => r.length));
  const lines = [`type { ${types} } := io.shex("nobel.shex")`, ""];
  shapes.forEach((s, i) => lines.push(`${rows[i]!.padEnd(width)} := io.csv("${s.source.file}")`));
  for (const s of shapes) {
    const row = `${s.type}Row`;
    const kept = s.properties.filter((p) => on.has(`${s.type}.${p.name}`) && (p.kind !== "link" || shapes.some((t) => t.type === p.to)));
    const pad = Math.max("@subject".length, ...kept.map((p) => p.name.length));
    lines.push("", `${plural[s.type] ?? s.type} : ${s.type} from ${row}`);
    lines.push(`    ${"@subject".padEnd(pad)} = "https://nobel.example/${s.type.toLowerCase()}/{${row}.${s.source.key}}"`);
    for (const p of kept) {
      const value =
        p.kind === "link" ? `${p.to}(${row}.${p.name})` : parse[p.kind] ? `${parse[p.kind]}(${row}.${p.name})` : `${row}.${p.name}`;
      lines.push(`    ${p.name.padEnd(pad)} = ${value}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
