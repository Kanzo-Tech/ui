"use client";

// The live extractor — the same `Extractor` the recorded run implements, over a real model.
//
// It hands the route handler the `Column[]` rudof projected out of the shape, so the model is
// asked for the columns the shape declares and nothing else. The events it yields are the events
// the showcase already consumes; nothing above this file knows which source it is talking to.

import type { ExtractEvent, Extractor, Shot } from "./extract";
import type { Column } from "./rudof";

interface Ready {
  ready: boolean;
  reason?: string;
  model?: string;
}

/** Ask before offering: a checkout with no key greys the option out instead of failing on click. */
export async function liveReady(signal?: AbortSignal): Promise<Ready> {
  try {
    const response = await fetch("/api/receipts/extract", { signal });
    return (await response.json()) as Ready;
  } catch {
    return { ready: false, reason: "No se pudo consultar el adaptador." };
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

/** Split an NDJSON body into whole lines as they arrive. */
async function* lines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let held = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    held += decoder.decode(value, { stream: true });
    const parts = held.split("\n");
    held = parts.pop() ?? "";
    for (const part of parts) if (part.trim()) yield part;
  }
  if (held.trim()) yield held;
}

export function liveExtractor(columns: Column[]): Extractor {
  return async function* (shots, signal): AsyncIterable<ExtractEvent> {
    const encoded = await Promise.all(shots.map(encode));
    if (signal.aborted) return;

    const response = await fetch("/api/receipts/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ shots: encoded, columns }),
      signal,
    });

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail || `El adaptador respondió ${response.status}.`);
    }

    // Rows are numbered here rather than by the model: an id is ours, and a model that repeated
    // one would silently merge two tickets into a row.
    let index = 0;
    for await (const line of lines(response.body)) {
      if (signal.aborted) return;
      const event = JSON.parse(line) as
        | { kind: "row"; row: WireRow }
        | { kind: "error"; message: string }
        | { kind: "done" };

      if (event.kind === "error") throw new Error(event.message);
      if (event.kind === "done") return;

      index += 1;
      const rowId = `live-${index}`;
      yield { kind: "row", rowId, shot: event.row.shot, crop: event.row.crop };
      for (const cell of event.row.cells) {
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
  };
}
