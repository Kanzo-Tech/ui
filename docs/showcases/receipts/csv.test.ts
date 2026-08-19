import { describe, expect, it } from "vitest";
import { BOM, SEPARATOR, csvName, toCsv } from "./csv";
import { RECORDED_CELLS, RECORDED_GAPS } from "./extract";
import type { Column, Row } from "./rudof";
import { TICKET_SHAPE } from "./shape";

/**
 * The CSV writer, and the fixture the showcase ships.
 *
 * The writer is the one part of this showcase whose output leaves the building, and the three
 * things Spanish Excel needs of it — `;`, the decimal comma, the BOM — are invisible on screen and
 * fatal in the file. A render cannot catch any of them.
 *
 * The columns here are the ones rudof projects out of `TICKET_SHAPE` at runtime, restated as a
 * fixture so this file needs no wasm. `reads its columns off the shape document` is what keeps the
 * restatement honest.
 */

/** What `openLedger(TICKET_SHAPE)` projects, in `sh:order`. */
const COLUMNS: Column[] = [
  { key: "fecha", iri: "", label: "Fecha", order: 1, type: "date", required: true },
  {
    key: "ticket",
    iri: "",
    label: "N.º ticket",
    order: 2,
    type: "string",
    pattern: "^[0-9]{12}$",
    required: true,
  },
  { key: "matricula", iri: "", label: "Matrícula", order: 3, type: "string", required: true },
  { key: "driver", iri: "", label: "Conductor", order: 4, type: "string", required: true },
  {
    key: "base",
    iri: "",
    label: "Base o escoba",
    order: 5,
    type: "string",
    options: ["Escoba", "Base", "Lavado"],
    required: true,
  },
  { key: "importe", iri: "", label: "Importe", order: 6, type: "decimal", required: true },
  { key: "kilometros", iri: "", label: "Kilómetros", order: 7, type: "integer", required: false },
];

const row = (cells: Partial<Record<string, string>>): Row => ({
  id: "t1",
  cells: {
    fecha: "2026-08-10",
    ticket: "262220788808",
    matricula: "1053NMB",
    driver: "Manu",
    base: "Escoba",
    importe: "46,02",
    kilometros: "14704",
    ...cells,
  },
});

describe("the CSV a Spanish Excel opens", () => {
  it("writes the header from sh:name, in sh:order", () => {
    const [header] = toCsv(COLUMNS, []).slice(BOM.length).split("\r\n");
    expect(header).toBe("Fecha;N.º ticket;Matrícula;Conductor;Base o escoba;Importe;Kilómetros");
  });

  it("reads its columns off the shape document", () => {
    // The fixture above is a transcription; this is the assertion that it did not drift. Every
    // label the writer emits has to be a `sh:name` in the shape, in the same `sh:order`.
    const declared = [...TICKET_SHAPE.matchAll(/sh:name "([^"]+)"[\s\S]*?sh:order (\d+)/g)]
      .map(([, name, order]) => ({ name, order: Number(order) }))
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.name);
    expect(COLUMNS.map((c) => c.label)).toEqual(declared);
  });

  it("separates with a semicolon, because es-ES Excel does", () => {
    // A comma-separated file with comma decimals arrives as one column of garbage.
    expect(SEPARATOR).toBe(";");
    expect(toCsv(COLUMNS, [row({})]).split("\r\n")[1]).toContain(";46,02;");
  });

  it("leads with a BOM, so CERDEÑO is not CERDEÃ‘O", () => {
    expect(toCsv(COLUMNS, []).startsWith("﻿")).toBe(true);
  });

  it("turns an ISO date into the one the sheet shows", () => {
    expect(toCsv(COLUMNS, [row({})]).split("\r\n")[1]).toMatch(/^10\/08\/2026;/);
  });

  it("leaves a cell the model could not read empty, never guessed", () => {
    const line = toCsv(COLUMNS, [row({ importe: "", base: "" })]).split("\r\n")[1];
    expect(line).toBe("10/08/2026;262220788808;1053NMB;Manu;;;14704");
  });

  it("quotes a value carrying the separator", () => {
    const line = toCsv(COLUMNS, [row({ driver: "Manu; Vane" })]).split("\r\n")[1];
    expect(line).toContain('"Manu; Vane"');
  });

  it("names the file after the last date in the ledger", () => {
    expect(csvName(COLUMNS, [row({}), { ...row({}), id: "t2", cells: { fecha: "2026-08-14" } }]))
      .toBe("repostajes-2026-08-14.csv");
    expect(csvName(COLUMNS, [])).toBe("repostajes.csv");
  });
});

describe("the recorded run", () => {
  it("leaves the cells the photograph does not carry", () => {
    // Six of thirty-five, and they are the point of the screen: two annotations under the laptop,
    // two tickets with no base written, one ambiguous plate, one importe cut off by the frame. A
    // fixture that filled them in would demonstrate the wrong thing.
    expect(RECORDED_CELLS).toBe(35);
    expect(RECORDED_GAPS).toBe(6);
  });
});
