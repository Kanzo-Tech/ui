import { describe, expect, it } from "vitest";
import { BOM, SEPARATOR, csvName, toCsv } from "./csv";
import { RECORDED_CELLS, RECORDED_GAPS } from "./extract";
import type { Column, Row } from "./rudof";
import { SLIP_SHAPE } from "./shape";

/**
 * The CSV writer, and the fixture the showcase ships.
 *
 * The writer is the one part of this showcase whose output leaves the building, and the three
 * things a European spreadsheet locale needs of it — `;`, the decimal comma, the BOM — are
 * invisible on screen and fatal in the file. A render cannot catch any of them.
 *
 * The columns here are the ones rudof projects out of `SLIP_SHAPE` at runtime, restated as a
 * fixture so this file needs no wasm. `reads its columns off the shape document` is what keeps the
 * restatement honest.
 */

/** What `openLedger(SLIP_SHAPE)` projects, in `sh:order`. */
const COLUMNS: Column[] = [
  { key: "date", iri: "", label: "Date", order: 1, type: "date", required: true },
  {
    key: "slip",
    iri: "",
    label: "Slip no.",
    order: 2,
    type: "string",
    pattern: "^[0-9]{12}$",
    required: true,
  },
  {
    key: "beast",
    iri: "",
    label: "Beast",
    order: 3,
    type: "string",
    options: ["Wyrm", "Basilisk", "Grimalkin", "Bog-hound", "Harpy", "Revenant", "Mimic", "Stoneback"],
    required: true,
  },
  { key: "observer", iri: "", label: "Observer", order: 4, type: "string", required: true },
  {
    key: "verdict",
    iri: "",
    label: "Verdict",
    order: 5,
    type: "string",
    options: ["confirmed", "disputed", "hoax"],
    required: true,
  },
  { key: "bounty", iri: "", label: "Bounty", order: 6, type: "decimal", required: true },
  { key: "leagues", iri: "", label: "Leagues", order: 7, type: "decimal", required: false },
];

const row = (cells: Partial<Record<string, string>>): Row => ({
  id: "s1",
  cells: {
    date: "2026-08-10",
    slip: "262220788808",
    beast: "Bog-hound",
    observer: "Piet Marrow",
    verdict: "confirmed",
    bounty: "15",
    leagues: "3,2",
    ...cells,
  },
});

describe("the CSV a spreadsheet opens", () => {
  it("writes the header from sh:name, in sh:order", () => {
    const [header] = toCsv(COLUMNS, []).slice(BOM.length).split("\r\n");
    expect(header).toBe("Date;Slip no.;Beast;Observer;Verdict;Bounty;Leagues");
  });

  it("reads its columns off the shape document", () => {
    // The fixture above is a transcription; this is the assertion that it did not drift. Every
    // label the writer emits has to be a `sh:name` in the shape, in the same `sh:order`.
    const declared = [...SLIP_SHAPE.matchAll(/sh:name "([^"]+)"[\s\S]*?sh:order (\d+)/g)]
      .map(([, name, order]) => ({ name, order: Number(order) }))
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.name);
    expect(COLUMNS.map((c) => c.label)).toEqual(declared);
  });

  it("separates with a semicolon, because the locale that writes 3,2 does", () => {
    // A comma-separated file with comma decimals arrives as one column of garbage.
    expect(SEPARATOR).toBe(";");
    expect(toCsv(COLUMNS, [row({})]).split("\r\n")[1]).toContain(";3,2");
  });

  it("leads with a BOM, so Inés is not InÃ©s", () => {
    expect(toCsv(COLUMNS, []).startsWith("﻿")).toBe(true);
  });

  it("turns an ISO date into the one the sheet shows", () => {
    expect(toCsv(COLUMNS, [row({})]).split("\r\n")[1]).toMatch(/^10\/08\/2026;/);
  });

  it("leaves a cell the model could not read empty, never guessed", () => {
    const line = toCsv(COLUMNS, [row({ bounty: "", verdict: "" })]).split("\r\n")[1];
    expect(line).toBe("10/08/2026;262220788808;Bog-hound;Piet Marrow;;;3,2");
  });

  it("quotes a value carrying the separator", () => {
    const line = toCsv(COLUMNS, [row({ observer: "Marrow; Vane" })]).split("\r\n")[1];
    expect(line).toContain('"Marrow; Vane"');
  });

  it("names the file after the last date in the ledger", () => {
    expect(csvName(COLUMNS, [row({}), { ...row({}), id: "s2", cells: { date: "2026-08-14" } }]))
      .toBe("sightings-2026-08-14.csv");
    expect(csvName(COLUMNS, [])).toBe("sightings.csv");
  });
});

describe("the recorded run", () => {
  it("leaves the cells the photograph does not carry", () => {
    // Six of thirty-five, and they are the point of the screen: two lines under the mug, one under
    // the hall's brass weight, two slips nobody settled, and one bounty off the bottom of the
    // frame. A fixture that filled them in would demonstrate the wrong thing.
    expect(RECORDED_CELLS).toBe(35);
    expect(RECORDED_GAPS).toBe(6);
  });
});
