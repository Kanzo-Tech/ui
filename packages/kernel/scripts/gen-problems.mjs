// problems.bnf → src/problems.gen.ts. `pnpm check:generated` regenerates it and fails on a difference.
// The grammar is the header of problems.bnf; every line this reads is a production of it, and a line
// that is not one is an error, never skipped.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORD = "[a-z][a-z0-9]*(?:-[a-z0-9]+)*";
const BASE = /^base "([^"]+)" \.$/;
const ROW = new RegExp(`^row (${WORD}/${WORD}) = (\\d{3}|-) ; "([^"]*)" ; (.+) \\.$`);
const FIELD = /^([a-zA-Z]+)(\?)?: (number|string)$/;

const lines = readFileSync(join(root, "problems.bnf"), "utf8")
  .replace(/\(\*[\s\S]*?\*\)/g, "")
  .split("\n")
  .map((line) => line.replace(/\s+/g, " ").trim())
  .filter((line) => line !== "");

const base = BASE.exec(lines[0] ?? "")?.[1];
if (!base) throw new Error('problems.bnf: the first line must be `base "<type URI prefix>" .`');

const rows = lines.slice(1).map((line) => {
  const match = ROW.exec(line);
  if (!match) throw new Error(`problems.bnf: not a row: ${line}`);
  const [, code, status, title, data] = match;
  if (status !== "-" && !(Number(status) >= 400 && Number(status) <= 599)) throw new Error(`problems.bnf: ${code}: status ${status} is not 400 to 599`);
  const fields = data === "-" ? [] : data.split(",").map((field) => {
    const f = FIELD.exec(field.trim());
    if (!f) throw new Error(`problems.bnf: ${code}: malformed field "${field}"`);
    return { name: f[1], optional: Boolean(f[2]), type: f[3] };
  });
  return { code, status: status === "-" ? null : Number(status), title, fields };
});

const codes = rows.map((row) => row.code);
if (new Set(codes).size !== codes.length) throw new Error("problems.bnf: a code appears twice");

const out = [
  "// GENERATED from problems.bnf by scripts/gen-problems.mjs — do not edit; `pnpm check:generated` fails on a diff.",
  "",
  "/** A problem's `type` is this followed by its code (RFC 9457 §3.1.1); derived, never written. */",
  `export const TYPE_BASE = ${JSON.stringify(base)};`,
  "",
  "export interface ProblemDataMap {",
  ...rows.map((r) => `  ${JSON.stringify(r.code)}: ${r.fields.length ? `{ ${r.fields.map((f) => `readonly ${f.name}${f.optional ? "?" : ""}: ${f.type}`).join("; ")} }` : "Record<string, never>"};`),
  "}",
  "",
  "/** Per code: the HTTP status where it crosses a wire, the title of the TYPE, the `data` fields and their types. */",
  "export const PROBLEMS: Readonly<Record<keyof ProblemDataMap, { readonly status?: number; readonly title: string; readonly data: Readonly<Record<string, \"number\" | \"string\">> }>> = {",
  ...rows.map((r) => `  ${JSON.stringify(r.code)}: { ${r.status ? `status: ${r.status}, ` : ""}title: ${JSON.stringify(r.title)}, data: { ${r.fields.map((f) => `${f.name}: ${JSON.stringify(f.type)}`).join(", ")} } },`),
  "};",
  "",
];
writeFileSync(join(root, "src/problems.gen.ts"), out.join("\n"));
