// The fourth consumer of the shape: the file Excel opens.
//
// Nothing here names a column. The header row is `sh:name` in `sh:order`, and the only reason
// this file knows a date from a decimal is `sh:datatype` — so a column added to the shape appears
// in the download without a line changing here.
//
// Shaped like a SPARQL SELECT result — *SPARQL 1.1 Query Results CSV/TSV* (Rec 2013), one row per
// solution and one column per projected variable, the variables being the shape's `sh:path`s in
// `sh:order`. One deliberate divergence: that spec makes the header row the VARIABLE NAMES, and
// this writer uses `sh:name` instead ("Slip no.", not "slip"). The file is opened in a spreadsheet,
// not read by a SPARQL client, and the shape already carries the human label — declaring the
// divergence beats silently shipping either one.
//
// The spreadsheet's LOCALE, specifically, and it is the reason none of this is RFC 4180. Opened by
// double-click, Excel splits on the list separator of the machine's locale — `;` across most of
// Europe, where the hall's own clerks write `3,2` for three and a fifth. Under that locale a
// correct RFC 4180 file arrives as one column of garbage, and `3.2` arrives as text.

import type { Column, Row } from "./rudof";

/** `2026-08-10` (what `xsd:date` requires) as `10/08/2026` (what the sheet shows). */
function localDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** A field is quoted only when it must be: a separator, a quote, or a newline inside it. */
function field(value: string): string {
  return /[;"\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function cell(value: string, column: Column): string {
  if (!value) return "";
  return field(column.type === "date" ? localDate(value) : value);
}

export const SEPARATOR = ";";

/** The BOM is what tells Excel the file is UTF-8; without it Inés Vault arrives as InÃ©s Vault. */
export const BOM = "﻿";

/** The rows as one CSV document — BOM, CRLF, `;`, and the decimal comma left exactly as typed. */
export function toCsv(columns: Column[], rows: Row[]): string {
  const lines = [columns.map((c) => field(c.label)).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((c) => cell(row.cells[c.key] ?? "", c)).join(SEPARATOR));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}

/** `sightings-2026-08-14.csv` — named after the last date in the ledger, which is what the file
 *  is about; falling back to the column order rather than to `Date.now()`, so the same rows
 *  always produce the same filename. */
export function csvName(columns: Column[], rows: Row[]): string {
  const dateKey = columns.find((c) => c.type === "date")?.key;
  const dates = dateKey
    ? rows.map((r) => r.cells[dateKey]).filter((v): v is string => Boolean(v)).sort()
    : [];
  const last = dates.at(-1);
  return last ? `sightings-${last}.csv` : "sightings.csv";
}
