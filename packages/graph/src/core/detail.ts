import { PAYLOAD_ADDRESS, PAYLOAD_COORDINATES, type Corpus, type TileMatrixSet } from "@fossil-lang/corpus";
import { denseOf, type VertexId } from "./resident";
import { tileOfDense } from "./tile-matrix";

/** One vertex's row, as its type's fields order it — every column but the address and the position. */
export interface VertexDetail {
  readonly vertex: VertexId;
  readonly fields: readonly { readonly name: string; readonly value: unknown }[];
}

const KEY = PAYLOAD_ADDRESS[0] as string;
const HIDDEN = new Set<string>([KEY, ...PAYLOAD_COORDINATES]);

/**
 * **Detail is fetched, not carried** — ADR 0001. A tile holds what the channels project; the rest of a
 * row is asked for when a reader focuses the vertex, as a scan of the one payload tile its `dense_id`
 * falls in, filtered to it. `corpus.node` takes an identity, and a tile carries an address, so the
 * address is what asks.
 */
export async function readVertex(
  corpus: Corpus,
  matrix: TileMatrixSet,
  vertex: VertexId,
  signal?: AbortSignal,
): Promise<VertexDetail | null> {
  const dense = denseOf(vertex);
  const address = tileOfDense(matrix, dense);
  const type = corpus.types.vertices.find((t) => t.type === matrix.type);
  if (!address || !type) return null;
  const names = type.fields.map((field) => field.name).filter((name) => !HIDDEN.has(name));
  const scan = corpus.scan({ type: matrix.type, filter: { column: KEY, op: "=", value: dense }, select: [KEY, ...names] });
  const [rows] = await scan.read([address], { signal });
  if (!rows || rows.numRows === 0) return null;
  return {
    vertex,
    fields: names.map((name) => ({ name, value: rows.getChild(name)?.toArray()[0] ?? null })),
  };
}
