"use client";

// The extraction seam, and one recorded run through it.
//
// An `Extractor` is a function returning an async iterable and honouring an `AbortSignal` —
// the same contract `useAiStream` takes, for the same reason: the showcase does not care whether
// the events came from a model, a fixture or a queue. `recorded` replays a real run over the
// photograph in `public/example/`; `live` (./live.ts) calls the model from the browser with the
// visitor's own key. Nothing below imports either.
//
// Why a model and not an OCR: three of the seven columns are NOT PRINTED on the slip at all.
// BEAST, OBSERVER and VERDICT are written in ink in the field, and a form OCR reads the printed
// layer only. Every low confidence and every gap in `RECORDED` is on one of those three, or on the
// one slip the frame cuts in half.

import type { Row } from "./rudof";
import { asset } from "@/example/assets";

/** One uploaded image. `src` is whatever an `<img>` can load — an object URL, or a public path. */
export interface Shot {
  id: string;
  name: string;
  src: string;
}

/** Where a slip sits inside its photograph, as fractions of the image. The review panel shows this
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

/** The photograph the recorded run was made from. Five slips, one shot. */
export const SAMPLE: Shot = {
  id: "sample",
  name: "sighting-slips.svg",
  src: asset("sighting-slips.svg"),
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
 * One run over `SAMPLE`, transcribed cell by cell.
 *
 * It is not a clean run and it is not meant to be, and every reason is visible in the photograph:
 * a mug stands on the second slip, the hall's brass weight lies across the fourth's beast line,
 * two slips were never settled so their verdict rule is blank, one hunter spells a beast the way
 * the bestiary does not, and the fifth slip runs off the bottom of the frame — so its bounty is
 * not in the picture at all. Six of thirty-five cells are unreadable. A demo that filled them in
 * would be demonstrating the wrong thing.
 */
const RECORDED: RecordedRow[] = [
  {
    rowId: "s1",
    crop: { x: 0.022, y: 0.1893, w: 0.186, h: 0.6213 },
    cells: {
      date: { value: "2026-08-10", confidence: 0.99 },
      slip: { value: "262220788808", confidence: 0.98 },
      beast: { value: "Bog-hound", confidence: 0.88 },
      observer: { value: "Piet Marrow", confidence: 0.84 },
      verdict: { value: "confirmed", confidence: 0.86 },
      bounty: { value: "15", confidence: 0.99 },
      leagues: { value: "3,2", confidence: 0.97 },
    },
  },
  {
    rowId: "s2",
    crop: { x: 0.212, y: 0.1827, w: 0.186, h: 0.6213 },
    cells: {
      date: { value: "2026-08-11", confidence: 0.99 },
      slip: { value: "262230893850", confidence: 0.98 },
      beast: {
        value: "Bog-hound",
        confidence: 0.61,
        note: "The mug stands on the line; only the first stroke and the descender are showing.",
      },
      observer: { value: "", confidence: 0, note: "Under the mug." },
      verdict: { value: "", confidence: 0, note: "Under the mug." },
      bounty: { value: "12", confidence: 0.99 },
      leagues: { value: "2,8", confidence: 0.97 },
    },
  },
  {
    rowId: "s3",
    crop: { x: 0.402, y: 0.1933, w: 0.186, h: 0.6213 },
    cells: {
      date: { value: "2026-08-11", confidence: 0.99 },
      slip: { value: "262230129159", confidence: 0.98 },
      beast: { value: "Grimalkin", confidence: 0.89 },
      observer: { value: "Hesper Vane", confidence: 0.85 },
      verdict: { value: "", confidence: 0, note: "The rule is blank: nobody settled this slip." },
      bounty: { value: "8", confidence: 0.99 },
      leagues: { value: "0,8", confidence: 0.97 },
    },
  },
  {
    rowId: "s4",
    crop: { x: 0.592, y: 0.1787, w: 0.186, h: 0.6213 },
    cells: {
      date: { value: "2026-08-12", confidence: 0.99 },
      slip: { value: "262240618448", confidence: 0.98 },
      beast: { value: "", confidence: 0, note: "The hall's brass weight lies across the line." },
      observer: { value: "Piet Marrow", confidence: 0.87 },
      verdict: { value: "confirmed", confidence: 0.88 },
      bounty: { value: "16", confidence: 0.99 },
      leagues: { value: "3,4", confidence: 0.97 },
    },
  },
  {
    rowId: "s5",
    crop: { x: 0.812, y: 0.4827, w: 0.186, h: 0.5173 },
    cells: {
      date: { value: "2026-08-14", confidence: 0.99 },
      slip: { value: "262260812341", confidence: 0.97 },
      beast: { value: "Basilisk", confidence: 0.83 },
      observer: {
        value: "Tomas Quilt",
        confidence: 0.63,
        note: "The last two strokes admit both Quill and Quilt; the roster has a Quill and no Quilt.",
      },
      verdict: { value: "", confidence: 0, note: "The rule is blank: nobody settled this slip." },
      bounty: {
        value: "",
        confidence: 0,
        note: "The slip runs off the bottom of the frame. The paper reads 21 g.",
      },
      leagues: { value: "6,0", confidence: 0.96 },
    },
  },
];

/** Order the events reach the screen in: the row first, then its cells down the slip. */
const CELL_ORDER = ["date", "slip", "beast", "observer", "verdict", "bounty", "leagues"];

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
