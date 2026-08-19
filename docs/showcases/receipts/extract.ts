"use client";

// The extraction seam, and one recorded run through it.
//
// An `Extractor` is a function returning an async iterable and honouring an `AbortSignal` —
// the same contract `useAiStream` takes, for the same reason: the showcase does not care whether
// the events came from a model, a fixture or a queue. `recorded` replays a real run over the photo
// in `public/receipts/`; `live` (./live.ts) posts the images to a route handler that calls the
// model. Nothing below imports either.
//
// Why a model and not an OCR: three of the seven columns are NOT PRINTED on the ticket at all.
// MATRICULA, DRIVER and BASE are written on the paper in biro, and a receipt OCR reads the
// printed layer only. Every low confidence and every gap in `RECORDED` is on one of those three,
// or on the one ticket the photo cuts in half.

import type { Row } from "./rudof";

/** One uploaded image. `src` is whatever an `<img>` can load — an object URL, or a public path. */
export interface Shot {
  id: string;
  name: string;
  src: string;
}

/** Where a ticket sits inside its photo, as fractions of the image. The review panel shows this
 *  crop beside the row, which is the only way a human can check a cell without hunting. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ExtractEvent =
  | { kind: "row"; rowId: string; shot: string; crop: Crop }
  | {
      kind: "cell";
      rowId: string;
      key: string;
      /** "" when the model could not read it. `sh:minCount` is what turns that into a finding. */
      value: string;
      confidence: number;
      /** Why it is empty or unsure — written for whoever has to check it against the paper. */
      note?: string;
    };

export type Extractor = (shots: Shot[], signal: AbortSignal) => AsyncIterable<ExtractEvent>;

/** The photo the recorded run was made from. Five tickets, one shot. */
export const SAMPLE: Shot = {
  id: "sample",
  name: "tickets.jpg",
  src: "/receipts/tickets.jpg",
};

interface RecordedCell {
  value: string;
  confidence: number;
  note?: string;
}

interface RecordedRow {
  rowId: string;
  crop: Crop;
  cells: Record<string, RecordedCell>;
}

/**
 * One real run over `SAMPLE`, transcribed cell by cell.
 *
 * It is not a clean run and it is not meant to be: two tickets have their biro annotation hidden
 * under the laptop lying on the table, one ticket was never annotated with a base, one plate is
 * genuinely ambiguous between NMD and NMB, and the fifth ticket is cut off by the edge of the
 * frame — so its IMPORTE is not in the photograph at all. Six of thirty-five cells are unreadable.
 * A demo that filled them in would be demonstrating the wrong thing.
 */
const RECORDED: RecordedRow[] = [
  {
    rowId: "t1",
    crop: { x: 0.02, y: 0.195, w: 0.205, h: 0.565 },
    cells: {
      fecha: { value: "2026-08-10", confidence: 0.99 },
      ticket: { value: "262220788808", confidence: 0.98 },
      matricula: { value: "1053NMB", confidence: 0.86 },
      driver: { value: "Manu", confidence: 0.78 },
      base: { value: "Escoba", confidence: 0.81 },
      importe: { value: "46,02", confidence: 0.99 },
      kilometros: { value: "14704", confidence: 0.97 },
    },
  },
  {
    rowId: "t2",
    crop: { x: 0.218, y: 0.215, w: 0.2, h: 0.535 },
    cells: {
      fecha: { value: "2026-08-11", confidence: 0.99 },
      ticket: { value: "262230893850", confidence: 0.98 },
      matricula: {
        value: "1053NMB",
        confidence: 0.62,
        note: "The annotation runs under the laptop; the three letters are a partial reading.",
      },
      driver: { value: "", confidence: 0, note: "Covered by the laptop." },
      base: { value: "", confidence: 0, note: "Covered by the laptop." },
      importe: { value: "57,96", confidence: 0.99 },
      kilometros: { value: "15144", confidence: 0.97 },
    },
  },
  {
    rowId: "t3",
    crop: { x: 0.422, y: 0.235, w: 0.2, h: 0.525 },
    cells: {
      fecha: { value: "2026-08-11", confidence: 0.99 },
      ticket: { value: "262230129159", confidence: 0.98 },
      matricula: { value: "1053NMB", confidence: 0.88 },
      driver: { value: "Vane", confidence: 0.84 },
      base: { value: "", confidence: 0, note: "This ticket carries no handwritten base." },
      importe: { value: "40,64", confidence: 0.99 },
      kilometros: { value: "15452", confidence: 0.97 },
    },
  },
  {
    rowId: "t4",
    crop: { x: 0.62, y: 0.25, w: 0.205, h: 0.525 },
    cells: {
      fecha: { value: "2026-08-12", confidence: 0.99 },
      ticket: { value: "262240618448", confidence: 0.98 },
      matricula: { value: "", confidence: 0, note: "The plate sits under the edge of the laptop." },
      driver: { value: "Manu", confidence: 0.87 },
      base: { value: "Escoba", confidence: 0.89 },
      importe: { value: "57,08", confidence: 0.99 },
      kilometros: { value: "15898", confidence: 0.97 },
    },
  },
  {
    rowId: "t5",
    crop: { x: 0.808, y: 0.222, w: 0.192, h: 0.535 },
    cells: {
      fecha: { value: "2026-08-14", confidence: 0.99 },
      ticket: { value: "262260812341", confidence: 0.97 },
      matricula: {
        value: "1053NMD",
        confidence: 0.64,
        note: "The last stroke admits both NMD and NMB; the rest of the fleet reads NMB.",
      },
      driver: { value: "Danny", confidence: 0.83 },
      base: { value: "", confidence: 0, note: "This ticket carries no handwritten base." },
      importe: {
        value: "",
        confidence: 0,
        note: "The ticket is cut off by the edge of the frame. The paper reads 26,29 L at 1,805 €/L.",
      },
      kilometros: { value: "16691", confidence: 0.96 },
    },
  },
];

/** Order the events reach the screen in: the row first, then its cells left to right. */
const CELL_ORDER = ["fecha", "ticket", "matricula", "driver", "base", "importe", "kilometros"];

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

/**
 * The recorded run, replayed at the pace a model streams at so the table fills in live rather
 * than appearing whole. Every await is cancellable: a stop mid-run leaves the rows already on
 * screen exactly as they were.
 */
export const recorded: Extractor = async function* (shots, signal) {
  const shot = shots[0]?.id ?? SAMPLE.id;
  for (const row of RECORDED) {
    if (signal.aborted) return;
    await wait(260, signal);
    if (signal.aborted) return;
    yield { kind: "row", rowId: row.rowId, shot, crop: row.crop };
    for (const key of CELL_ORDER) {
      const cell = row.cells[key];
      if (!cell) continue;
      await wait(70, signal);
      if (signal.aborted) return;
      yield {
        kind: "cell",
        rowId: row.rowId,
        key,
        value: cell.value,
        confidence: cell.confidence,
        note: cell.note,
      };
    }
  }
};

/** How many cells the recorded run leaves for a human — quoted in the docs page, and computed
 *  here so the page cannot claim a number the fixture stopped having. */
export const RECORDED_GAPS = RECORDED.reduce(
  (n, row) => n + Object.values(row.cells).filter((c) => !c.value).length,
  0,
);

export const RECORDED_CELLS = RECORDED.reduce((n, row) => n + Object.keys(row.cells).length, 0);

/** An empty row, for the "add a row by hand" path. */
export const blankRow = (id: string, keys: string[]): Row => ({
  id,
  cells: Object.fromEntries(keys.map((k) => [k, ""])),
});
