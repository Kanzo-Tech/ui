// problems.bnf → src/problems.gen.ts. `pnpm check:generated` regenerates it and fails on a difference.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CODE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
// The reason phrases of RFC 9110 §15, for the statuses a row may use; `toJSON` writes one as `title`.
const PHRASES = { 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 409: "Conflict", 429: "Too Many Requests", 500: "Internal Server Error", 501: "Not Implemented", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout" };

const rows = readFileSync(join(root, "problems.bnf"), "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("#"))
  .map((line) => {
    const [code, status, title, data, ...extra] = line.split("|").map((cell) => cell.trim());
    if (!CODE.test(code ?? "") || extra.length || data === undefined) throw new Error(`problems.bnf: malformed row: ${line}`);
    if (status !== "-" && !PHRASES[status]) throw new Error(`problems.bnf: ${code}: status ${status} has no phrase`);
    const fields = data === "-" ? [] : data.split(",").map((field) => {
      const match = /^([a-zA-Z]+)(\?)?: (number|string)$/.exec(field.trim());
      if (!match) throw new Error(`problems.bnf: ${code}: malformed field "${field}"`);
      return { name: match[1], optional: Boolean(match[2]), type: match[3] };
    });
    return { code, status: status === "-" ? null : Number(status), title, fields };
  });

const codes = rows.map((row) => row.code);
if (new Set(codes).size !== codes.length) throw new Error("problems.bnf: a code appears twice");

const out = [
  "// GENERATED from problems.bnf by scripts/gen-problems.mjs — do not edit; `pnpm check:generated` fails on a diff.",
  "",
  "export interface ProblemDataMap {",
  ...rows.map((r) => `  ${JSON.stringify(r.code)}: ${r.fields.length ? `{ ${r.fields.map((f) => `readonly ${f.name}${f.optional ? "?" : ""}: ${f.type}`).join("; ")} }` : "Record<string, never>"};`),
  "}",
  "",
  "export const PROBLEMS: Readonly<Record<keyof ProblemDataMap, { readonly status?: number; readonly title: string }>> = {",
  ...rows.map((r) => `  ${JSON.stringify(r.code)}: { ${r.status ? `status: ${r.status}, ` : ""}title: ${JSON.stringify(r.title)} },`),
  "};",
  "",
  "export const PHRASES: Readonly<Record<number, string>> = {",
  ...Object.entries(PHRASES).map(([status, phrase]) => `  ${status}: ${JSON.stringify(phrase)},`),
  "};",
  "",
];
writeFileSync(join(root, "src/problems.gen.ts"), out.join("\n"));
