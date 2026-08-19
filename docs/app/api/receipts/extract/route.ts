// The live half of the extraction seam: the same events the recorded run yields, produced by a
// vision model instead of a fixture.
//
// It runs here rather than in the browser for one reason — the key. The showcase never sees it,
// and a checkout without one gets a 501 from `GET`, which is what greys out "Modelo en vivo"
// instead of letting the button fail on click.
//
// The columns are NOT written here either. The client sends the `Column[]` that rudof projected
// out of the SHACL shape, and the tool schema below is generated from it — so the model is asked
// for exactly the columns the table shows, the CSV writes, and the validator checks.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Column {
  key: string;
  label: string;
  description?: string;
  type: "date" | "string" | "decimal" | "integer";
  pattern?: string;
  options?: string[];
  required: boolean;
}

interface Shot {
  id: string;
  mediaType: string;
  /** base64, no data: prefix. */
  data: string;
}

const MODEL = "claude-opus-5";

/** Is there a key? The panel asks before it offers the live option. */
export function GET() {
  return process.env.ANTHROPIC_API_KEY
    ? NextResponse.json({ ready: true, model: MODEL })
    : NextResponse.json(
        { ready: false, reason: "Falta ANTHROPIC_API_KEY; la corrida grabada sigue disponible." },
        { status: 501 },
      );
}

/** One line per column, so the model reads the shape's own words rather than a paraphrase. */
function describe(column: Column): string {
  const bits = [`- \`${column.key}\` (${column.label})`];
  if (column.description) bits.push(column.description);
  const facets: string[] = [column.type];
  if (column.pattern) bits.push(`must match /${column.pattern}/`);
  if (column.options) bits.push(`one of: ${column.options.join(", ")}`);
  facets.push(column.required ? "required" : "optional");
  return [bits.join(" — "), facets.join(", ")].join(" [") + "]";
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

export async function POST(request: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY." }, { status: 501 });
  }

  const { shots, columns } = (await request.json()) as { shots: Shot[]; columns: Column[] };
  if (!shots?.length || !columns?.length) {
    return NextResponse.json({ error: "Faltan las fotos o las columnas." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: key });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const run = client.messages.stream({
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
                ...shots.map((shot) => ({
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: shot.mediaType as "image/jpeg",
                    data: shot.data,
                  },
                })),
                {
                  type: "text" as const,
                  text: `Las fotos, en orden, son: ${shots.map((s) => s.id).join(", ")}.`,
                },
              ],
            },
          ],
        });

        let buffer = "";
        let cursor = 0;
        run.on("text", (delta) => {
          buffer += delta;
          for (const [row, next] of completedRows(buffer, cursor)) {
            cursor = next;
            send({ kind: "row", row });
          }
        });

        const message = await run.finalMessage();
        // A refusal is an HTTP 200 with an empty or partial body — checked before the content is
        // read, because indexing into it is what breaks.
        if (message.stop_reason === "refusal") {
          send({ kind: "error", message: "El modelo declinó leer estas imágenes." });
        }
        send({ kind: "done" });
      } catch (e) {
        send({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
