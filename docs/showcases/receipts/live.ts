"use client";

// The live extractor — the same `Extractor` the recorded run implements, over a real model.
//
// It runs IN THE BROWSER. The key it uses is the visitor's own, pasted into Preferences and kept
// in their `localStorage`; these are public docs, so there is no key of ours to protect and a
// route handler in front of the model would only be a hop that reads somebody else's secret.
// `dangerouslyAllowBrowser` is the SDK's opt-in for exactly this arrangement, and it also sends
// the header that makes the API answer a browser at all.
//
// The columns are NOT written here. They are the `Column[]` rudof projected out of the SHACL
// shape, so the model is asked for exactly the columns the table shows, the CSV writes and the
// validator checks — the same claim the recorded run makes, made against a real model.

import Anthropic from "@anthropic-ai/sdk";
import type { ExtractEvent, Extractor, Shot } from "./extract";
import type { Column } from "./rudof";

const MODEL = "claude-opus-5";

/** Where the visitor's key lives. Their browser, and nowhere else — not the prefs cookie, which
 *  travels to the server on every request, and not a route handler, which would be the server. */
const STORAGE = "kanzo-receipts-anthropic-key";

export function readKey(): string {
  try {
    return globalThis.localStorage?.getItem(STORAGE) ?? "";
  } catch {
    // Storage can be denied outright (Safari's private mode, a third-party frame). A showcase
    // that cannot remember the key still works; it just asks again.
    return "";
  }
}

export function writeKey(key: string): void {
  try {
    if (key) globalThis.localStorage?.setItem(STORAGE, key);
    else globalThis.localStorage?.removeItem(STORAGE);
  } catch {
    // Same as above: not remembering is a worse experience, not a broken one.
  }
}

/** Whatever an `<img>` can load, as the base64 the API takes. */
async function encode(shot: Shot): Promise<{ id: string; mediaType: string; data: string }> {
  const blob = await (await fetch(shot.src)).blob();
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return {
    id: shot.id,
    mediaType: blob.type || "image/jpeg",
    data: btoa(binary),
  };
}

interface WireCell {
  key: string;
  value: string;
  confidence: number;
  note?: string;
}

interface WireRow {
  shot: string;
  crop: { x: number; y: number; w: number; h: number };
  cells: WireCell[];
}

/** One line per column, so the model reads the shape's own words rather than a paraphrase. */
function describe(column: Column): string {
  const bits = [`- \`${column.key}\` (${column.label})`];
  if (column.description) bits.push(column.description);
  const facets: string[] = [column.type];
  if (column.pattern) bits.push(`must match /${column.pattern}/`);
  if (column.options) bits.push(`one of: ${column.options.join(", ")}`);
  facets.push(column.required ? "required" : "optional");
  return `${[bits.join(" — "), facets.join(", ")].join(" [")}]`;
}

/**
 * The schema is generated, and `key` is an enum rather than a dynamic property name: structured
 * outputs need every object closed with `additionalProperties: false` and every property listed in
 * `required`, which a map keyed by column would fight.
 */
function schemaFor(columns: Column[]) {
  return {
    type: "object",
    properties: {
      rows: {
        type: "array",
        description: "Un elemento por ticket encontrado, en el orden en que aparecen.",
        items: {
          type: "object",
          properties: {
            crop: {
              type: "object",
              description: "Dónde está el ticket dentro de su foto, en fracciones de 0 a 1.",
              properties: {
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number" },
                h: { type: "number" },
              },
              required: ["x", "y", "w", "h"],
              additionalProperties: false,
            },
            shot: { type: "string", description: "El id de la foto donde está este ticket." },
            cells: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", enum: columns.map((c) => c.key) },
                  value: {
                    type: "string",
                    description: "Cadena vacía si no se puede leer. Nunca inventes un valor.",
                  },
                  confidence: { type: "number" },
                  note: {
                    type: "string",
                    description:
                      "Por qué está vacío o es dudoso, para quien tenga que cotejarlo con el papel. Vacío si no hay nada que decir.",
                  },
                },
                required: ["key", "value", "confidence", "note"],
                additionalProperties: false,
              },
            },
          },
          required: ["crop", "shot", "cells"],
          additionalProperties: false,
        },
      },
    },
    required: ["rows"],
    additionalProperties: false,
  };
}

const system = (columns: Column[]) => `You transcribe Spanish fuel receipts into the rows of a ledger.

One photo may hold several receipts: each receipt is one row, and you return its crop so whoever
reviews it can look at the paper beside the number.

The column list below is projected from a SHACL shape. Each entry carries the shape's own
\`sh:description\`, which is what distinguishes values the receipt prints side by side — read them.

Columns:
${columns.map(describe).join("\n")}

Rules:
- A value you cannot read goes back empty, with a note saying why (covered, cut off, blurred,
  never written). Never infer it and never invent it: a human reviews these, and an empty cell
  costs one glance while an invented one costs a reconciliation.
- Dates in ISO (2026-08-10). Amounts with a decimal comma, as they are typed in Spain.
- \`confidence\` from 0 to 1, honest: print reads better than handwriting.
- Notes in English; the values themselves exactly as the paper has them.`;

/** Emit each row as soon as its object closes, instead of waiting for the whole array. */
function* completedRows(buffer: string, from: number): Generator<[unknown, number]> {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = from; i < buffer.length; i += 1) {
    const c = buffer[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        try {
          yield [JSON.parse(buffer.slice(start, i + 1)), i + 1];
        } catch {
          // Not a row yet — the outer object's opening brace. Keep scanning.
        }
        start = -1;
      }
    }
  }
}

/** What a row the model closed becomes: the id is ours, because a model that repeated one would
 *  silently merge two tickets into a row. */
function* eventsFor(row: WireRow, index: number): Generator<ExtractEvent> {
  const rowId = `live-${index}`;
  yield { kind: "row", rowId, shot: row.shot, crop: row.crop };
  for (const cell of row.cells) {
    yield {
      kind: "cell",
      rowId,
      key: cell.key,
      value: cell.value,
      confidence: cell.confidence,
      note: cell.note || undefined,
    };
  }
}

export function liveExtractor(columns: Column[], key: string): Extractor {
  return async function* (shots, signal): AsyncIterable<ExtractEvent> {
    const encoded = await Promise.all(shots.map(encode));
    if (signal.aborted) return;

    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    const run = client.messages.stream(
      {
        model: MODEL,
        // Thinking is on by default on this model and `max_tokens` caps thinking plus text
        // together, so the budget is generous rather than sized to the answer.
        max_tokens: 32000,
        system: system(columns),
        output_config: { format: { type: "json_schema", schema: schemaFor(columns) } },
        messages: [
          {
            role: "user",
            content: [
              ...encoded.map((shot) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: shot.mediaType as "image/jpeg",
                  data: shot.data,
                },
              })),
              {
                type: "text" as const,
                text: `Las fotos, en orden, son: ${encoded.map((s) => s.id).join(", ")}.`,
              },
            ],
          },
        ],
      },
      { signal },
    );

    let buffer = "";
    let cursor = 0;
    let index = 0;
    for await (const event of run) {
      if (signal.aborted) return;
      if (event.type !== "content_block_delta" || event.delta.type !== "text_delta") continue;
      buffer += event.delta.text;
      for (const [row, next] of completedRows(buffer, cursor)) {
        cursor = next;
        index += 1;
        yield* eventsFor(row as WireRow, index);
      }
    }

    // A refusal is a successful response with an empty or partial body, so it is checked on the
    // final message rather than caught — indexing into the content is what would break.
    const message = await run.finalMessage();
    if (message.stop_reason === "refusal") {
      throw new Error("The model declined to read these images.");
    }
  };
}
