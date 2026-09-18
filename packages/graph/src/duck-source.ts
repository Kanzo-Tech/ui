"use client";

import {
  PAYLOAD_ADDRESS,
  PAYLOAD_COORDINATES,
  PAYLOAD_IDENTITY,
  open as openFossilCorpus,
} from "@fossil-lang/corpus";
import type { OpenOptions } from "@fossil-lang/corpus";
import { clausePoints, column, fillColumn, numbers } from "@kanzo-tech/mosaic";
import type { Coordinator, FilterExpr, Selection } from "@kanzo-tech/mosaic";
import type { BoundedSource, Slice, SliceRequest, Viewport } from "./bounded";
import { SliceRead } from "./slice-client";
import { denseOf, typeOf, vertexId, type VertexId } from "./resident";

/**
 * A `BoundedSource` over two ordinary relations in DuckDB.
 *
 * On a subpath because Mosaic is an optional peer and this is the half that needs it: a host drawing
 * arrays it already holds takes `memorySource` and pays for no database. Splitting them is what lets
 * that promise be true rather than merely stated.
 *
 * **Neutral about storage, and that is the point.** The neutrality let bounded be measured against
 * unbounded before anything committed to a layout on disk — and it is the reason this file survived
 * a decision on the other side of the seam. The verb it was written to sit beside never landed:
 * `viewport` was dropped and GraphAr with it, because the camera is addressed rather than queried.
 * What replaces it is a tile fetched by a computed URL, which is another source.
 *
 * **Every query in this file goes through a `SliceRead`, and there is no other path.** `onceQuery`
 * was the other one — a throwaway client per query, on this subpath, re-exported for the two
 * showcases that also read a relation directly. It is gone: a read the page's filters cannot reach
 * is a picture that disagrees with the page, and `slice-client.ts` carries what that cost.
 */

/**
 * A DuckDB-backed source, and the one thing it can do that the render contract knows nothing about.
 *
 * `BoundedSource` says what a renderer needs: answer a bounded question. Publishing a selection is
 * the other direction of the same seam and it is Mosaic's, not the renderer's — so it lives on the
 * concrete type rather than on the contract, beside `watch`, which is on the contract because the
 * query loop is what has to act on it.
 */
export interface DuckSource extends BoundedSource {
  /**
   * The reader's own selection, as a clause the rest of the page filters by. `null` retracts it.
   *
   * **The graph is exempt from its own clause, and that is the whole difference from the greyout it
   * replaces.** While the canvas *faded* excluded rows it could take its own clause too — the row was
   * still drawn and still selectable, and the fade was the brush. A canvas that now draws what
   * survives would answer a lasso by deleting everything the reader did not lasso, which is not a
   * selection, it is a filter nobody asked for.
   */
  publish(vertices: readonly VertexId[] | null): void;
}

export interface DuckSourceOptions {
  coordinator: Coordinator;
  /**
   * The crossfilter this graph draws inside.
   *
   * Given, the page's predicate rides in the slice query and the canvas draws **what survives**.
   * Omitted, the source is a reader of a relation and nothing else — which is what a graph with no
   * charts beside it is.
   */
  filterBy?: Selection;
  /** The node relation. */
  nodes: string;
  /** The edge relation, as pairs of node ids. */
  edges: string;
  /**
   * Which vertex type this relation is.
   *
   * Required, and with no default, because the source is the only thing that knows: a `dense_id`
   * numbers within one type, so the identity a slice carries is only completed here. A corpus of one
   * type is type `0` and has to say so — a defaulted `0` would let a second relation ship the same
   * identities as the first with nothing raised.
   */
  typeIndex: number;
  /**
   * A **dense** integer id — `0..n-1`, no gaps.
   *
   * Dense because `links` refers to positions rather than to ids, so a consumer never pays for an
   * id→index map. GraphAr's `dense_id` is this column by another name.
   */
  idField?: string;
  /**
   * The identity column — the subject IRI. **Omitted, a slice carries addresses only.**
   *
   * A `dense_id` says where a vertex is; the IRI says which vertex it is, and only the second
   * survives the layout being redone. The corpus writes it as `subject`, non-null and unique within
   * a type, which is why that is the name here — but it stays opt-in rather than defaulted, because
   * reading it costs 1.87× the drawing tile and most points are painted rather than named.
   *
   * Set it when something outlives a session: a bookmark, a link out, a selection that has to mean
   * the same thing after the next `fossil run`.
   */
  subjectField?: string;
  xField?: string;
  yField?: string;
  /**
   * **What colours and what sizes are not here**, and their absence is the shape rather than an
   * omission: they are `fill` and `r` on the request, because a channel is what the caller wants
   * drawn now and this object is where the bytes are. Given here too, recolouring meant building a
   * second source — and two places deciding one colour is the state that move ended.
   */
  sourceField?: string;
  targetField?: string;
}

interface Columns {
  id: string;
  /** `undefined` when the host did not ask to be able to name a vertex. */
  subject: string | undefined;
  x: string;
  y: string;
  /**
   * The categorical column, when a channel named one — **and `undefined` is not a missing value.**
   *
   * It used to default to `community`, in both sources, which is this side writing what the corpus
   * owns: a relation that has no such column answered `Referenced column "community" not found`, and
   * one that has a differently named cluster column was silently coloured by the wrong thing. Neither
   * failure is the caller's, and both were invented here.
   *
   * Unbound, every point is one colour — which is Plot's own answer to a mark with no `fill` channel,
   * and an honest picture rather than a guess.
   */
  category: string | undefined;
  size: string | undefined;
  source: string;
  target: string;
}

/**
 * The three reads a source makes, and which of them the page can filter.
 *
 * `points` and `links` carry the crossfilter; `meta` deliberately does not. How big the corpus is,
 * where it sits and what its tile footers say are facts about the corpus rather than about the
 * page's current question — and a `total()` that shrank with the filters would make the view's own
 * "20,000 of 1,000,000" a fraction of itself, which is the one number a bounded renderer owes its
 * reader honestly.
 */
interface Reads {
  points: SliceRead;
  links: SliceRead;
  meta: SliceRead;
}

function openReads(coordinator: Coordinator, filterBy?: Selection): Reads {
  return {
    points: new SliceRead(coordinator, filterBy),
    links: new SliceRead(coordinator, filterBy),
    meta: new SliceRead(coordinator),
  };
}

/**
 * The metadata reads, queued behind each other.
 *
 * One client answers one question at a time — a second `ask` supersedes the first — and `total()`,
 * `extent()` and the tile probing are issued by different effects with no ordering between them. A
 * queue rather than a client each, because they *already* run one at a time: DuckDB-WASM answers
 * over one connection, measured, so three clients would buy three registrations and no concurrency.
 */
function metaAsker(read: SliceRead): (sql: string) => Promise<unknown> {
  let queue: Promise<unknown> = Promise.resolve();
  return (sql) => {
    const next = queue.then(() => read.ask(() => sql));
    queue = next.catch(() => undefined);
    return next;
  };
}

/**
 * The page's predicate, as SQL text.
 *
 * The reads here are CTEs over window functions rather than builder queries — `row_number()` over the
 * visible set is what makes a slice's links speak in buffer positions — so the predicate has to be
 * interpolated rather than handed to `Query.where`. Mosaic's expression nodes stringify to the same
 * SQL the builder would emit, which is what makes that safe rather than a re-implementation.
 */
function predicateSql(filter: FilterExpr | undefined): string {
  if (filter == null) return "";
  const list = Array.isArray(filter) ? filter : [filter];
  const clauses = list.filter((node) => node != null).map((node) => String(node));
  return clauses.length > 0 ? clauses.map((c) => `(${c})`).join(" AND ") : "";
}

/** Two predicates, conjoined, where an absent one contributes nothing rather than `AND TRUE`. */
function both(left: string, right: string): string {
  if (!left) return right || "TRUE";
  if (!right) return left;
  return `(${left}) AND (${right})`;
}

export function duckBoundedSource(options: DuckSourceOptions): DuckSource {
  const { coordinator, edges, filterBy, nodes, typeIndex } = options;
  /**
   * Everything this relation *is*, and nothing about what to draw.
   *
   * `category` and `size` are absent here and filled in per request from `fill` and `r` — the same
   * split `openCorpus` makes with its own `fixed` block, for the same reason.
   */
  const columns: Omit<Columns, "category" | "size"> = {
    id: options.idField ?? "id",
    subject: options.subjectField,
    x: options.xField ?? "x",
    y: options.yField ?? "y",
    source: options.sourceField ?? "source",
    target: options.targetField ?? "target",
  };

  const reads = openReads(coordinator, filterBy);
  const meta = metaAsker(reads.meta);
  const watching = watcher(reads);

  return {
    ...watching.api,

    publish(vertices) {
      publishSelection(reads, filterBy, columns.id, vertices);
    },

    async total() {
      const rows = await meta(`SELECT count(*) AS n FROM ${nodes}`);
      return Number(numbers(rows, "n")[0] ?? 0);
    },

    /**
     * Four aggregates, so the canvas can frame what is actually there.
     *
     * One scan of two columns, once — against a first paint that otherwise opens on the renderer's
     * default box and finds the corpus occupying a corner of it.
     */
    async extent() {
      const rows = await meta(
        `SELECT min(${columns.x}) AS x0, max(${columns.x}) AS x1,
                min(${columns.y}) AS y0, max(${columns.y}) AS y1
         FROM ${nodes}`,
      );
      const at = (field: string) => Number(numbers(rows, field)[0] ?? 0);
      return { xMin: at("x0"), yMin: at("y0"), xMax: at("x1"), yMax: at("y1") };
    },

    /**
     * Regions only, and it says so by **not having** `explore`.
     *
     * This source is two relations and a spatial predicate — it has no adjacency index, so a
     * neighbourhood query would mean recursive joins over the whole edge table, which is the
     * unbounded pattern wearing a bounded interface. It used to say that with a predicate and a
     * throw; now the absence is the statement, and asking is a compile error.
     */
    async slice(request: SliceRequest): Promise<Slice> {
      const { fill, limit, minLinkPixels, perPixel, pinned, r, view } = request;
      const asked: Columns = { ...columns, category: fill, size: r };
      // No `held`: this source reads a relation rather than addressing bytes, so there is nothing
      // "already in hand" to draw a far end from — see `anchorCte`.
      return watching.run(
        region(nodes, edges, asked, view, limit, typeIndex, pinned, perPixel, minLinkPixels, undefined),
      );
    },
  };
}

/**
 * The re-indexing happens in SQL, and that is the whole trick.
 *
 * `row_number() - 1` over the visible set gives every returned point a position in the arrays about
 * to be built, so the edge query can join to it twice and hand back links that already speak in
 * those positions. No id→index map is constructed in JavaScript — which is the 148 ms `load()` spent
 * at 200,000 nodes, gone by construction rather than by optimisation.
 *
 * The `LIMIT` sits inside the CTE, so the numbering is over what survives it. Numbering first and
 * limiting after would hand out indices into an array that was never built.
 */
/**
 * A rectangle as a SQL predicate, and an **unbounded** rectangle as no predicate at all.
 *
 * `shouldSlice` answers `false` for a graph that fits, and the loop then asks for everything — a
 * viewport whose edges are `±Infinity`. Interpolated, that reads `x BETWEEN -Infinity AND Infinity`,
 * and SQL has no infinity literal: DuckDB parses `Infinity` as a **column name** and fails with
 * `Referenced column "Infinity" not found`. So an open edge contributes no clause, and a rectangle
 * open on every side is `TRUE` — which is also the right plan, because a query that wants every row
 * has nothing to prune.
 */
function bboxSql(c: Columns, view: Viewport): string {
  const bounds: [string, number, string][] = [
    [c.x, view.xMin, ">="],
    [c.x, view.xMax, "<="],
    [c.y, view.yMin, ">="],
    [c.y, view.yMax, "<="],
  ];
  const clauses = bounds
    .filter(([, value]) => Number.isFinite(value))
    .map(([column, value, op]) => `${column} ${op} ${value}`);
  return clauses.length > 0 ? clauses.join(" AND ") : "TRUE";
}

/**
 * How far apart the sampled ids are — one every `ceil(matched / limit)`.
 *
 * **In SQL rather than in JavaScript because the number it divides is only known inside the query.**
 * `matched` is a window aggregate over the rows the `WHERE` kept, so a caller wanting to compute
 * this outside would have to count first and slice second — two round trips down a connection that
 * answers one at a time, which is the shape `BENCHMARKS.md` records as a hung tab rather than a slow
 * one. As a column reference it costs the pass that was being made anyway.
 *
 * `greatest(1, …)` because an empty window makes the divisor zero, and a modulo by zero is an error
 * rather than an empty answer. At `matched <= limit` it is exactly 1 and `id % 1 = 0` keeps every
 * row: a window that fits is not sampled, it is returned.
 */
const strideSql = (limit: number) => `greatest(1, CAST(ceil(matched / ${limit}.0) AS BIGINT))`;

/**
 * The visible set: what the rectangle matched, and the sample of it that gets drawn.
 *
 * **Two CTEs, and the second one is the whole of the far view.** `pool` is every row the predicate
 * kept, carrying `count(*) OVER ()` — a window function is evaluated over everything the `WHERE`
 * kept and `LIMIT` applies after it, so that column is the number that *matched* rather than the
 * number returned. It is what deleted the third query: `SELECT count(*) FROM … WHERE <the same
 * predicate>` was a second scan to learn a number the first scan already had to compute.
 *
 * `vis` then keeps one row in `stride`, **striding over the id rather than taking the front of the
 * ordering**, and that is the difference between a picture of the window and a picture of one corner
 * of it. A corpus numbers `dense_id` along the Morton curve, so every `s`-th id is a spatially
 * stratified sample; the same `LIMIT` with no stride returns a contiguous run of the curve, which is
 * a sub-region. Measured against the truth at screen resolution, L1@8px over blocks of eight pixels:
 * a stride sample of 20,000 scores 0.167 / 0.240 / 0.269 at 200k / 1M / 5M against a uniform null of
 * 1.044 / 0.829 / 0.731 — see `/docs/design/graph`.
 *
 * @param matched Whether to project the pre-sample count out to the caller.
 *
 * It rides on the points read only. The links read builds the same CTEs to join against and never
 * looks at the column — but it does compute it, because the stride is a function of it and both
 * reads have to select the *same* rows or a slice would draw edges to vertices it did not return.
 */
function visibleCte(
  nodes: string,
  c: Columns,
  where: string,
  limit: number,
  matched = true,
): string {
  const size = c.size ? `, ${c.size} AS size` : "";
  // Selected in the CTE rather than joined back afterwards: the numbering is over what survives the
  // LIMIT, and a second pass keyed on `local` would be a second scan to fetch a column the first one
  // was already standing on.
  const subject = c.subject ? `, ${c.subject} AS subject` : "";
  // No categorical binding, no ranking: a literal zero is the ordinal every point wears, and the
  // scale hands that one colour. Ranking a column nobody named is how a default column gets invented.
  // Ranked over the sample rather than over the window, so the ordinals are contiguous across what
  // is actually drawn — which is what the colour scale is handed.
  const category = c.category
    ? `(dense_rank() OVER (ORDER BY cat) - 1)::INTEGER AS category`
    : "0::INTEGER AS category";
  return `WITH pool AS (
    SELECT ${c.id} AS id, ${c.x} AS x, ${c.y} AS y${size}${subject}${
      c.category ? `, ${c.category} AS cat` : ""
    },
           count(*) OVER () AS matched
    FROM ${nodes}
    WHERE ${where}
  ), vis AS (
    SELECT id, x, y${c.size ? ", size" : ""}${c.subject ? ", subject" : ""}${
      matched ? ", matched" : ""
    },
           ${category},
           (row_number() OVER (ORDER BY id) - 1)::INTEGER AS local
    FROM pool
    WHERE id % ${strideSql(limit)} = 0
    LIMIT ${limit}
  )`;
}

/**
 * The shortest edge worth a row, as a predicate over the two endpoints — **squared, and on purpose.**
 *
 * A distance is compared against a threshold, and squaring both sides removes a `sqrt` per row from
 * a predicate evaluated once per candidate edge. It changes no answer: both sides are non-negative.
 *
 * `undefined` when the caller said nothing about resolution, and then there is no predicate at all
 * rather than a permissive one — a request with no canvas behind it (`EVERYTHING`) has no pixels to
 * measure three of.
 */
function longEnough(
  a: string,
  b: string,
  perPixel: number | undefined,
  minLinkPixels: number,
): string {
  if (perPixel === undefined || !Number.isFinite(perPixel) || perPixel <= 0) return "";
  const floor = minLinkPixels * perPixel;
  return `(${a}.x - ${b}.x) * (${a}.x - ${b}.x) + (${a}.y - ${b}.y) * (${a}.y - ${b}.y) >= ${floor * floor}`;
}

/**
 * The far ends, and the edges that reach them — **out of bytes the reader already fetched.**
 *
 * An edge with one end outside the rectangle is dropped today, and that loses 19.31% / 31.94% /
 * 28.92% of the edges incident to a window at 200k / 1M / 5M; 7,930 of 20,000 vertices carry at least
 * one at five million. What was missing was never the edge row — a window reads the `by_source` tiles
 * of every vertex it draws, so the row is in hand — it was **a position to draw the far end at**.
 *
 * **And a tile answers that for free.** A tile is 4,096 rows of a Morton-ordered relation and its
 * bounding box is far wider than the rows the rectangle keeps, so the vertices just outside the
 * window are usually in a tile the window already fetched. Measured over five windows of
 * `docs/public/bench/1000000`, 2026-08-19: relaxing the join from *inside the rectangle* to *inside
 * the tiles that were read* takes the drawn edges of five windows from 616,885 to 781,562 of 906,337
 * incident — **56.9% of everything the reader was losing, at no request, no query and no byte.**
 *
 * **The tile boundary is also a distance filter, and that is what settles the drawing.** Over every
 * far end a window loses, the median sits 1.64 semi-widths out and the worst 47.1 — which is why a
 * stub clipped to the viewport is a lie: nothing distinguishes 1.1 from 47. The far ends a held tile
 * can answer are the near ones: median 1.11–1.85 semi-widths, 90th percentile 1.29–2.60, worst
 * **6.74**, against 7.09–16.91 for the full reachable set. So the honest picture and the free one are
 * the same picture, and there is no trade to make: the anchors are drawn where the vertices are, and
 * the long tail stays undrawn because its bytes are not here — not because we decided.
 *
 * @param held The relation whose rows the reader is holding — the tiles a corpus fetched for this
 *   window. **`undefined` for a source over an ordinary relation, and that is not a downgrade, it is
 *   the truth:** nothing is "already in hand" there, so `held` would be the whole node table and the
 *   join would scan the corpus twice per camera move. Only an addressed source knows what it holds.
 */
function anchorCte(
  held: string,
  edges: string,
  c: Columns,
  spatial: string,
  filter: string,
  perPixel: number | undefined,
  minLinkPixels: number,
): string {
  const outside = both(`NOT (${spatial})`, filter);
  const long = longEnough("a", "b", perPixel, minLinkPixels);
  return `, out AS (
    SELECT ${c.id} AS id, ${c.x} AS x, ${c.y} AS y FROM ${held} WHERE ${outside}
  ), reach AS (
    SELECT id, x, y FROM vis UNION ALL SELECT id, x, y FROM out
  ), span AS (
    SELECT sv.local AS src, tv.local AS dst, a.id AS src_id, b.id AS dst_id
    FROM ${edges} e
    JOIN reach a ON e.${c.source} = a.id
    JOIN reach b ON e.${c.target} = b.id
    LEFT JOIN vis sv ON sv.id = a.id
    LEFT JOIN vis tv ON tv.id = b.id
    WHERE (sv.id IS NOT NULL OR tv.id IS NOT NULL)${long ? ` AND ${long}` : ""}
  ), anchor AS (
    SELECT o.id, o.x, o.y,
           ((SELECT count(*) FROM vis) + row_number() OVER (ORDER BY o.id) - 1)::INTEGER AS local
    FROM out o
    WHERE o.id IN (SELECT src_id FROM span WHERE src IS NULL
                   UNION SELECT dst_id FROM span WHERE dst IS NULL)
  )`;
}

/**
 * A question, in the two halves it is asked in and the one place they are put back together.
 *
 * The reads run through the coordinator, so the *same* pair of SQL builders serves both directions:
 * the camera pulling an answer, and the page's filters pushing one. `assemble` is therefore a
 * function of the two results and of nothing else — no closure over which of the two paths asked,
 * because a slice that came back because somebody brushed a histogram is the same slice.
 */
interface Plan {
  points: (filter: FilterExpr) => string;
  links: (filter: FilterExpr) => string;
  assemble: (points: unknown, links: unknown) => Slice;
}

/**
 * The one plan there is: a rectangle, its sample, and the edges both of whose ends survived it.
 *
 * It was called `detail` because it was one of two, and the other one — a `GROUP BY` over a
 * categorical column, one super-node per group — is gone. There is no mode to be in.
 */
function region(
  nodes: string,
  edges: string,
  c: Columns,
  view: Viewport,
  limit: number,
  typeIndex: number,
  pinned: VertexId[] | undefined,
  perPixel: number | undefined,
  minLinkPixels: number,
  held: string | undefined,
): Plan {
  const bbox = bboxSql(c, view);
  // A dragged node is drawn where the reader dropped it and indexed where it always was, so the
  // rectangle cannot find it. Riding along in the predicate is what keeps it on screen — and it
  // stays a predicate rather than a second query so the numbering still covers everything returned.
  //
  // Only this relation's own vertices: a pinned set spans the whole canvas, and asking one node
  // table for another type's dense ids returns the wrong rows rather than none.
  const mine = (pinned ?? []).filter((v) => typeOf(v) === typeIndex).map(denseOf);
  const pins = mine.length > 0 ? ` OR ${c.id} IN (${mine.join(",")})` : "";
  const spatial = `(${bbox})${pins}`;
  /**
   * The page's predicate outside the pin, not inside it.
   *
   * A pin says *where to look*; the filters say *what exists*. Written the other way round —
   * `bbox AND filter OR pinned` — a pinned node would survive a filter that excludes it, and the
   * canvas would draw a vertex the rest of the page has agreed is not there.
   */
  const where = (filter: FilterExpr) => both(spatial, predicateSql(filter));
  const size = c.size ? ", size" : "";
  const subject = c.subject ? ", subject" : "";
  const near = longEnough("s", "t", perPixel, minLinkPixels);
  const anchors = (filter: FilterExpr) =>
    held
      ? anchorCte(held, edges, c, spatial, predicateSql(filter), perPixel, minLinkPixels)
      : "";

  return {
    /**
     * The marks, then the anchors, in one answer — because they are one buffer.
     *
     * `ORDER BY local` is load-bearing rather than tidy: `local` runs `0..marks-1` over the sample
     * and continues past it over the anchors, so ordering by it puts every mark before every anchor
     * and makes `marks` a prefix length. `matched` is then still read off row zero.
     */
    points: (filter) =>
      `${visibleCte(nodes, c, where(filter), limit)}${anchors(filter)}
       SELECT local, id, x, y, category, matched, TRUE AS mark${size}${subject} FROM vis${
         held
           ? `
       UNION ALL
       SELECT local, id, x, y, 0::INTEGER, NULL::BIGINT, FALSE AS mark${
         c.size ? ", CAST(NULL AS DOUBLE)" : ""
       }${c.subject ? ", CAST(NULL AS VARCHAR)" : ""} FROM anchor`
           : ""
       }
       ORDER BY local`,
    /**
     * One end drawn and both ends positioned — or, where nothing is held, both ends drawn.
     *
     * The second form is what a source over an ordinary relation gets, and it is the old query plus
     * the length predicate. It still drops an edge that leaves the window, and the reason is now
     * exact rather than a limitation of the reader: no bytes beyond the rectangle were fetched, so
     * there is no position to draw the far end at. A corpus fetches tiles and therefore has some.
     */
    links: (filter) =>
      held
        ? `${visibleCte(nodes, c, where(filter), limit, false)}${anchors(filter)}
        SELECT coalesce(sp.src, sa.local) AS src, coalesce(sp.dst, da.local) AS dst
        FROM span sp
        LEFT JOIN anchor sa ON sa.id = sp.src_id
        LEFT JOIN anchor da ON da.id = sp.dst_id`
        : `${visibleCte(nodes, c, where(filter), limit, false)}
        SELECT s.local AS src, t.local AS dst
        FROM ${edges} e
        JOIN vis s ON e.${c.source} = s.id
        JOIN vis t ON e.${c.target} = t.id${
          near ? `
        WHERE ${near}` : ""
        }`,
    assemble: (points, links) => ({
      /**
       * How many matched, separately from how many came back.
       *
       * Without it the view cannot tell a reader "there is more here than I am showing you", and a
       * truncated slice looks exactly like a complete one — which is the failure this whole branch
       * has been about. Read off the first row rather than asked for: `matched` is constant down the
       * column, and an empty answer has no row and no matches, which agree.
       */
      n: Number(numbers(points, "matched")[0] ?? 0),
      ...arrays(points, links, typeIndex, c.size ? "size" : undefined, c.subject !== undefined),
    }),
  };
}

/**
 * The half of a source that runs a [`Plan`], and the half that answers when nobody asked.
 *
 * Both sources need exactly this and neither should own a second copy of it — which is why it is a
 * function over the reads rather than two blocks of the same bookkeeping. What it holds is the
 * *standing* plan: the last question the camera put, kept so an answer arriving because the page
 * filtered something can be put back together the same way.
 */
function watcher(reads: Reads) {
  let standing: Plan | null = null;
  let listener: ((slice: Slice) => void) | null = null;
  /** The half-answers of a push, waiting for their sibling. */
  const landed = new Map<"points" | "links", unknown>();

  const arrived = (half: "points" | "links") => (data: unknown) => {
    if (!standing || !listener) return;
    landed.set(half, data);
    if (landed.size < 2) return;
    const points = landed.get("points");
    const links = landed.get("links");
    landed.clear();
    listener(standing.assemble(points, links));
  };

  return {
    api: {
      /**
       * Say when the answer changes for a reason the camera cannot see.
       *
       * The reason it hands over a whole `Slice` rather than a nudge to ask again: the coordinator
       * has *already* re-run both reads with the new predicate by the time we hear about it. Asking
       * again would run the same two queries a second time to learn what is in hand.
       */
      watch(answered: (slice: Slice) => void): () => void {
        listener = answered;
        reads.points.onAnswer = arrived("points");
        reads.links.onAnswer = arrived("links");
        return () => {
          listener = null;
          landed.clear();
          standing = null;
          reads.points.release();
          reads.links.release();
          reads.meta.release();
        };
      },
    },
    async run(plan: Plan): Promise<Slice> {
      standing = plan;
      // Cleared because these two are halves of the *previous* question: keeping one would pair a
      // stale rectangle's points with the new rectangle's links the next time the page filters.
      landed.clear();
      const [points, links] = await Promise.all([
        reads.points.ask(plan.points),
        reads.links.ask(plan.links),
      ]);
      return plan.assemble(points, links);
    },
  };
}

/**
 * The reader's own gesture, as a clause — and the graph exempted from it.
 *
 * `clausePoints` defaults `clients` to the clause's source when that source is itself a client, which
 * is the exemption a crossfilter is built on. Here the source is a plain object and there are two
 * clients to exempt, so the set is written out: a lasso must filter the page's charts and leave the
 * canvas showing what the reader lassoed *in context*, rather than deleting everything else.
 */
function publishSelection(
  reads: Reads,
  filterBy: Selection | undefined,
  idField: string,
  vertices: readonly VertexId[] | null,
): void {
  if (!filterBy) return;
  filterBy.update(
    clausePoints([idField], vertices?.map((vertex) => [denseOf(vertex)]), {
      source: reads.points,
      clients: new Set([reads.points, reads.links]),
    }),
  );
}

/**
 * Arrow columns to the parallel typed arrays the renderer takes — sized once, filled in place.
 *
 * `fillColumn` rather than `numbers`: Arrow already hands back a typed buffer, and the obvious route
 * through `Array.from(...).map(Number)` allocates two full-length boxed arrays on the way to a third
 * that was the actual destination. Three copies to move nothing. Here the point buffers are sized
 * against the query's own `LIMIT` and each column is written straight into its stride, so `x` and
 * `y` interleave with no seam between them and no intermediate at all.
 */
function arrays(
  points: unknown,
  links: unknown,
  typeIndex: number,
  sizeField?: string,
  withSubjects = false,
): Omit<Slice, "n"> {
  // Sized from the answer rather than from the request's `limit`, which it used to be: an answer
  // carries the window's marks *and* the anchors the edges leaving it end at, so `limit` is no longer
  // an upper bound on the rows. Under-sizing here would drop the anchors silently and leave every
  // link that pointed at one indexing past the buffer.
  const rows = countOf(points, "x");
  const positions = new Float32Array(rows * 2);
  const n = fillColumn(points, "x", positions, 0, 2);
  fillColumn(points, "y", positions, 1, 2);

  // Where the marks stop. `mark` is `TRUE` down the sample and `FALSE` down the anchors, and the
  // query orders by `local`, so this is a prefix length rather than a count — which is what lets
  // `residentOf` and `buffers` treat "is this a mark" as an index comparison.
  const marked = new Int32Array(rows);
  fillColumn(points, "mark", marked);
  let marks = 0;
  while (marks < n && marked[marks] !== 0) marks++;

  // The dense ids land in a scratch and are widened into identities as they are copied across.
  //
  // In place, into the destination, would be better and is not available: `fillColumn` writes
  // `Number(…)`, and a `BigUint64Array` element takes a `bigint` only — assigning a `number` to one
  // throws rather than coercing. That refusal is the same guarantee this whole change is for, so the
  // extra `n`-long buffer is the price of the boundary being enforced by the runtime and not by us.
  const dense = new Float64Array(n);
  fillColumn(points, "id", dense);
  const vertices = new BigUint64Array(n);
  for (let i = 0; i < n; i++) vertices[i] = vertexId(typeIndex, dense[i] as number);
  const categories = new Uint16Array(n);
  fillColumn(points, "category", categories);

  // `column` rather than `fillColumn`: an IRI is a string, so there is no typed buffer to write
  // into and no interleaving to express. It is the one thing a slice carries that never reaches the
  // GPU, which is why asking for it is a decision rather than a default.
  const subjects = withSubjects ? (column(points, "subject") as string[]) : undefined;

  let sizes: Float32Array | undefined;
  if (sizeField) {
    sizes = new Float32Array(n);
    fillColumn(points, sizeField, sizes);
  }

  // The edge count is not bounded by the point limit, so it is asked for rather than assumed.
  const edgeCount = countOf(links, "src");
  const edges = new Float32Array(edgeCount * 2);
  const wrote = fillColumn(links, "src", edges, 0, 2);
  fillColumn(links, "dst", edges, 1, 2);

  return {
    marks,
    vertices,
    subjects,
    positions: positions.subarray(0, n * 2),
    links: edges.subarray(0, wrote * 2),
    categories,
    sizes,
  };
}

/** A row count for a result that does not advertise one, without materialising the rows. */
function countOf(rows: unknown, field: string): number {
  const advertised = (rows as { numRows?: number } | null)?.numRows;
  if (typeof advertised === "number") return advertised;
  const child = (rows as { getChild?: (f: string) => { length: number } | null })?.getChild?.(field);
  if (child) return child.length;
  return Array.from(rows as Iterable<unknown>).length;
}

/**
 * A corpus that fossil wrote, read by address — **and the addressing is fossil's.**
 *
 * **The five things a call site used to know, and now does not.** Drawing a corpus meant deriving
 * the chunk URLs from a `chunk_size` copied by hand, knowing how a tile is named, knowing what the
 * edge directory is called, knowing GraphAr's column names, and knowing that a glob cannot work over
 * a plain HTTP origin because there is no listing. Five conventions and about forty lines, none of
 * it the business of something that wants to draw a graph. `/docs/design/graph` carries the
 * argument; the copied `chunk_size` carries the evidence, because it went stale and read
 * a fraction of a corpus in silence for as long as it did.
 *
 * The consumer knows one thing: **where the corpus is.**
 *
 * ```ts
 * const { source } = await openCorpus({ coordinator, dest: "/bench/1000000", wasmUrl });
 * ```
 *
 * **And this side no longer knows the conventions either, which is the change.** It used to remove
 * that defect for its callers by committing it one level down — a YAML line-scanner, a
 * `chunk{k}.parquet` spelling, a `by_source/tile{k}.parquet` spelling and a `HEAD`-probing search
 * for a tile count — and by the time those were deleted all four were **wrong**: fossil writes
 * `container: rowgroups`, one `tiles.parquet` whose row groups are the tiles, and `vertex_count`
 * had been in the manifest the whole time the search was probing for it. Fossil's `open` is
 * `fossil_graph::plan` compiled to wasm32: the arithmetic the native reader runs, not a second
 * implementation of it that agrees until it does not.
 *
 * **Addressed, not queried.** The manifests and the per-tile boxes are read once and kept; after
 * that a camera move is arithmetic over boxes and a list of URLs. There is deliberately no request
 * on the path between the camera moving and a URL being computable — the moment there is one, this
 * has become the `viewport` verb fossil deleted.
 *
 * **What it is not.** It takes no column names and no type index. Those come from the manifest or
 * they do not come: a corpus reader that also accepts `idField` is `duckBoundedSource` with extra
 * steps, and there is already one of those for the case this is not — an arbitrary relation with
 * `x`/`y` that nobody wrote as a corpus.
 */

export interface OpenCorpusOptions {
  coordinator: Coordinator;
  /**
   * The crossfilter this graph draws inside — the same `Selection` the page's charts filter by.
   *
   * Given, the predicate rides in the slice query and the canvas draws what survives.
   */
  filterBy?: Selection;
  /** Where the corpus lives, without a trailing slash — the directory holding `graph.graph.yml`. */
  dest: string;
  /**
   * Where `fossil_graph_wasm_bg.wasm` is.
   *
   * **The one thing about fossil's reader a caller still has to say, and not ours to default.** The
   * addressing runs in WASM, so the module has to be up before a URL can be composed, and only the
   * caller knows how its bundler resolves an asset — `?url` under Vite, an asset import under Next,
   * a `Response` over the bytes in Node. Passed straight through, spelled as fossil spells it.
   * Omitted, the boot is left to whoever already did it: it is memoised for the session, so a host
   * on its second corpus need not say it again.
   */
  wasmUrl?: OpenOptions["wasmUrl"];
  /**
   * Which vertex type to draw, when a corpus carries more than one.
   *
   * Defaults to the first the manifest names. A corpus of one type never passes it; a corpus of
   * several has to, because *which graph do you mean* is not a question a reader can answer.
   */
  vertexType?: string;
  /**
   * Read the identity column as well. **Off by default, and the same trade as everywhere else:**
   * `subject` costs about twice the drawing tile, so the drawing path carries addresses and a host
   * asks for names when something has to be *named* rather than painted.
   */
  subjects?: boolean;
}

/** One tile's bounding box, from the footer. A tile with no `x`/`y` statistics is not in the list. */
interface TileBox {
  tile: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * One manifest, as text — **the whole of what this file still knows about reading a corpus.**
 *
 * It takes an absolute URL because that is what fossil's door hands it. `open(dest, { readText })`
 * composes every address itself: it reads the index, then the per-type manifests the index names,
 * and nothing else. Which files those are is no longer a question asked on this side — the
 * twelve-line scan of the index's `vertices:`/`edges:` lists that used to stand here was the third
 * copy of a sequence the door now publishes, and the index's own file name left this file with it.
 *
 * A file that is not there raises here and reaches the caller as a `CorpusManifestError` naming the
 * URL, which is a better error than any invented on this side.
 */
async function manifest(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`corpus: ${url} is not readable (${response.status})`);
  return response.text();
}

/**
 * An opened corpus: the half that **draws** and the half that **answers**.
 *
 * A host needs both over the same bytes and they are not the same access. The canvas reads tiles by
 * address — a handful of files per camera move, chosen from the footer's boxes, with no query. A
 * chart, a crossfilter clause or a verb reads the *relation*: every row, by column name, in SQL.
 * Hiding the URLs behind `source` is right for the first and leaves the second with nothing to
 * query, so opening a corpus registers views for it.
 *
 * This is the other side's own shape. `fossil-mcp` describes itself as opening a dataset,
 * *registering views over the Parquet the corpus already holds*, and dispatching a verb — the same
 * two halves, named the same way, one call apart.
 */
export interface OpenedCorpus {
  /**
   * For the canvas: `<GraphCanvas source={…}>`. Reads tiles, never the whole relation.
   *
   * A `DuckSource`, and `CorpusSource` is gone with the reason it existed: `extent()` was declared
   * there because a source over an unlaid-out relation has no answer to it, and *optional on the
   * base contract* says that better than a second interface — a relation with `x`/`y` has an extent
   * too, and it was the one host that could not frame its opening view.
   */
  source: DuckSource;
  /**
   * The vertex relation, registered and ready to query by name.
   *
   * Every column the manifest declares, including the corpus' own properties — so a clause a chart
   * publishes over `kind` or `region` lands here with no translation, which is what makes one
   * crossfilter serve the canvas and the charts.
   */
  nodes: string;
  /** The source-ordered edge relation, or `undefined` when the corpus declares no edge for this type. */
  edges: string | undefined;
}

export async function openCorpus(options: OpenCorpusOptions): Promise<OpenedCorpus> {
  const { coordinator, dest, filterBy, subjects = false, vertexType, wasmUrl } = options;

  const reads = openReads(coordinator, filterBy);
  const meta = metaAsker(reads.meta);
  const watching = watcher(reads);

  /**
   * The addressing — **one `await`, one lent capability, and no arithmetic of ours.**
   *
   * Fossil's `open` takes where the corpus is and a way to read text, and hands back every URL the
   * corpus can produce, whichever container it declares. It needs no engine on this rung: lent a
   * reader, it fetches the index and the per-type manifests the index names, and nothing more.
   * What used to stand here — a line-scanning YAML reader, a `chunk{k}` spelling, an
   * edge-directory spelling and a `HEAD`-probing search for a tile count — was four conventions
   * fossil owns, written down on this side, and stale in all four by the time they were deleted.
   * A fifth went the same way once the door published the sequence rather than the file name: the
   * scan that worked out which manifests to ask for.
   *
   * **`readText` and not `manifestFiles`**, which is the other engine-free rung: holding the bytes
   * is what that one is for, and this never held them for its own sake — it fetched them only to
   * hand them over.
   */
  const addressing = await openFossilCorpus(dest, { readText: manifest, wasmUrl });

  const type = addressing.vertexType(vertexType);
  /**
   * The relation whose SOURCE is this type — the CSR orientation, which is the drawing read.
   *
   * `by_target` is not asked for and its absence is reported rather than hidden: a window's
   * drawable edges all have their source on screen, so the source-aligned tiles are complete for
   * drawing and incomplete for incidence. `tilesFor` says which below, in `gaps`.
   */
  const edge = addressing.incident(type.type).find((e) => e.srcType === type.type);
  const adjacency = edge?.adjacency("src") ?? null;

  /**
   * The boxes, and the one query this source makes that is not a slice.
   *
   * Read on first use rather than in the factory: a host that constructs a source and never draws
   * should not pay for it, and the cost is a footer read over the payload. Kept forever after —
   * tiles are precomputed and their boxes cannot move without the corpus being rewritten.
   *
   * **Held as the promise rather than as the answer**, which the move to one shared metadata client
   * forced and which was a latent defect before it: `total()` and `extent()` are called by different
   * effects with nothing ordering them, so two loads used to run concurrently and probe the whole
   * tile range twice.
   */
  let loading: Promise<TileBox[]> | null = null;

  /**
   * The tiles a window needs, held as bytes so that **panning back is free**.
   *
   * This is the one item on `BENCHMARKS.md`'s fix list that no amount of query tuning substitutes
   * for, and the measurement that puts it there is blunt: two of six drag steps at ten million
   * transfer zero new bytes and still cost 247 requests each, because every visit re-reads the same
   * footers and column chunks over HTTP. A tile fetched once and registered as a file is read from
   * memory forever after — no request, no range negotiation, no metadata round trip.
   *
   * **Keyed on the URL and not on the tile**, which is what makes it container-independent for
   * free: under `files` a tile is a file and the two keys agree, and under `rowgroups` every tile
   * names one `tiles.parquet`, which a tile-keyed cache would fetch once per tile.
   *
   * **The trade is honest and not free.** A registered file is the *whole* file, where DuckDB over
   * HTTP reads only the column chunks a query projects — the first visit costs more bytes and every
   * later one costs none. Which way that nets out depends on how the corpus is cut, which is the
   * corpus's decision and not ours.
   *
   * Discovered rather than required: a coordinator whose connector is not DuckDB-WASM has no
   * filesystem to register into, and reads by URL exactly as before. `@duckdb/duckdb-wasm` is
   * deliberately not a dependency of this package, so the capability is named structurally.
   */
  interface Registrar {
    registerFileBuffer(name: string, buffer: Uint8Array): Promise<void>;
    dropFile(name: string): Promise<void>;
  }
  const registrar = async (): Promise<Registrar | null> => {
    const connector = coordinator.databaseConnector?.() as
      | { getDuckDB?: () => Promise<Registrar> }
      | null
      | undefined;
    if (!connector?.getDuckDB) return null;
    try {
      return await connector.getDuckDB();
    } catch {
      return null;
    }
  };

  /** Registered name → how many bytes it is holding. Insertion order is the eviction order. */
  const resident = new Map<string, number>();
  /** URL → the name DuckDB should read it from, once that has been decided one way or the other. */
  const decided = new Map<string, string>();
  let held = 0;

  /**
   * Sixty-four megabytes of tiles, evicted oldest-first.
   *
   * A budget rather than a count, because a tile's size is the corpus's decision and a count would
   * mean something different for every one. Oldest-first rather than least-recently-used: a reader
   * pans, and a pan revisits what it just left, so recency and insertion order agree where it
   * matters — and an LRU's bookkeeping is a second structure to keep correct for a difference nobody
   * has measured.
   */
  const BUDGET = 64 * 1024 * 1024;

  /**
   * A file is worth holding when it is **cheap to fetch whole** — 256 KB, and the number is
   * measured.
   *
   * Registering a file means downloading all of it. On the million-node corpus a vertex chunk was
   * 74 KB and the edge chunks far larger, and caching both took a cold window from about 200 ms to
   * **17,979 ms** while a repeat fell to **11 ms** — a thousandfold win on revisit paid for with an
   * eighteen-second first paint, which is not a trade anybody would take.
   *
   * So the rule is a property of the file rather than a flag, and the corpus decides: one
   * `tiles.parquet` per set decides against, which is right for it — the row groups a window wants
   * are a byte range, and a range read is what DuckDB already does.
   */
  const WORTH_HOLDING = 256 * 1024;

  /**
   * The names DuckDB should read these URLs from — registered buffers where possible, URLs where
   * not, quoted either way.
   *
   * Fetched concurrently, because a window is a handful of files and they are independent; a
   * sequential loop here would make the first paint the sum of them rather than the slowest.
   */
  async function readable(urls: readonly string[]): Promise<string[]> {
    if (urls.length === 0) return [];
    const db = await registrar();
    if (!db) return urls.map((url) => `'${url}'`);
    const names = await Promise.all(
      urls.map(async (url) => {
        const already = decided.get(url);
        if (already !== undefined && (!already.startsWith("'") ? resident.has(already) : true)) {
          return already;
        }
        // A name DuckDB can hold a buffer under, derived from the URL so that two tiles of two
        // types never collide and the same tile twice never registers twice.
        const name = `corpus_${url.replace(/[^A-Za-z0-9]+/g, "_")}`;
        // The size first, which is one metadata request against a body that may be megabytes — and
        // the same request a footer read already makes, so the shape is not new here.
        const probe = await fetch(url, { method: "HEAD" });
        const size = Number(probe.headers.get("content-length"));
        if (!probe.ok || !Number.isFinite(size) || size > WORTH_HOLDING) {
          const plain = `'${url}'`;
          decided.set(url, plain);
          return plain;
        }
        const response = await fetch(url);
        // A file that will not load is not a reason to fail the whole window: fall back to the URL
        // and let DuckDB report whatever it finds there, which is the error a reader can act on.
        if (!response.ok) return `'${url}'`;
        const bytes = new Uint8Array(await response.arrayBuffer());
        await db.registerFileBuffer(name, bytes);
        resident.set(name, bytes.byteLength);
        decided.set(url, name);
        held += bytes.byteLength;
        return name;
      }),
    );
    while (held > BUDGET && resident.size > 0) {
      const [oldest, size] = resident.entries().next().value as [string, number];
      // Never evict a file this very window is about to read, or the query reads a dropped file.
      if (names.includes(oldest)) break;
      resident.delete(oldest);
      held -= size;
      await db.dropFile(oldest);
    }
    return names.map((n) => (n.startsWith("'") ? n : `'${n}'`));
  }

  /**
   * Where the payload is, as the list of files that hold it.
   *
   * One file per tile under `container: files`, one file in total under `rowgroups` — and this side
   * does not know or care which, because the address is asked for rather than composed. Throws when
   * the manifest declares no `vertex_count`, which is the one absence that makes a corpus
   * un-enumerable.
   */
  const payloadFiles = type.files();
  /** A URL list as a SQL list literal. Every read below composes one and none of them composes a URL. */
  const quoted = (urls: readonly string[]) =>
    urls.map((url) => `'${url.replace(/'/g, "''")}'`).join(", ");

  /**
   * The boxes, from the footer — **which tile a row group is, asked of the addressing.**
   *
   * `parquet_metadata` reports a `file_name` and a `row_group_id`, and which of the two names the
   * tile is the container's business: under `rowgroups` row group `k` IS tile `k`; under `files`
   * the file is, and its row groups are the writer's business, so their boxes are merged. This used
   * to read the tile out of the URL with `regexp_extract(file_name, 'chunk(\d+)')` — one
   * container's spelling hard-coded into a query, and `NULL` for every row of a corpus fossil
   * writes today.
   *
   * `min_value`/`max_value`, never `min`/`max`. Parquet's original statistics fields are defined by
   * *signed* byte comparison, which is meaningless for an unsigned column — a writer that gets this
   * right leaves them empty. A reader that only knows the deprecated pair concludes the footer
   * carries no box for the column the whole address is built on. `coalesce` keeps the float columns
   * working either way.
   */
  function load(): Promise<TileBox[]> {
    loading ??= (async () => {
      const files = quoted(payloadFiles);
      const [xCol, yCol] = PAYLOAD_COORDINATES;
      // Which of `file_name` and `row_group_id` names the tile, as an expression rather than as a
      // branch in JavaScript: the grouping has to happen where the rows are either way.
      const tile =
        addressing.container === "rowgroups"
          ? "row_group_id"
          : `list_position([${files}], file_name) - 1`;
      const stats = await meta(
        `SELECT ${tile} AS tile,
           min(CASE WHEN path_in_schema = '${xCol}' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS x0,
           max(CASE WHEN path_in_schema = '${xCol}' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS x1,
           min(CASE WHEN path_in_schema = '${yCol}' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS y0,
           max(CASE WHEN path_in_schema = '${yCol}' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS y1
         FROM parquet_metadata([${files}])
         WHERE path_in_schema IN ('${xCol}', '${yCol}') GROUP BY 1 ORDER BY 1`,
      );
      const tiles = numbers(stats, "tile");
      const [x0, x1, y0, y1] = ["x0", "x1", "y0", "y1"].map((f) => numbers(stats, f));
      return tiles.map((t, i) => ({
        tile: t as number,
        x0: x0?.[i] as number,
        x1: x1?.[i] as number,
        y0: y0?.[i] as number,
        y1: y1?.[i] as number,
      }));
    })();
    return loading;
  }

  /** The tiles a rectangle touches. Pure — this is the whole of the selection, and it makes no call. */
  function intersecting(all: TileBox[], view: Viewport): number[] {
    return all
      .filter((b) => b.x1 >= view.xMin && b.x0 <= view.xMax && b.y1 >= view.yMin && b.y0 <= view.yMax)
      .map((b) => b.tile);
  }

  /**
   * Everything the corpus fixes, and nothing it does not — **by ROLE, not by name.**
   *
   * The address, the identity and the coordinates are facts of the format, and the names they are
   * written under come off `@fossil-lang/corpus`'s generated column table rather than four string
   * literals here. The endpoint columns come off the adjacency's own address. What colours and what
   * sizes are channels, so they arrive with the request and are filled in per slice.
   */
  const fixed = {
    id: PAYLOAD_ADDRESS[0] as string,
    subject: subjects ? (PAYLOAD_IDENTITY[0] as string) : undefined,
    x: PAYLOAD_COORDINATES[0] as string,
    y: PAYLOAD_COORDINATES[1] as string,
    source: adjacency?.column ?? "src_dense",
    target: edge?.adjacency("dst")?.column ?? "dst_dense",
  } as const;

  /**
   * The relation half, registered once at open.
   *
   * A view rather than a table: `CREATE TABLE AS` would pull the corpus into memory, which is the
   * working set the whole bounded path exists to refuse. A view leaves the bytes where they are and
   * lets each query fetch the ranges it needs.
   *
   * Over **every** file of the payload, deliberately — this is the surface that answers *what does
   * it mean*, and a count, a histogram or a crossfilter clause is a question about the corpus rather
   * than about the window. The addressed reading is `slice`, beside it, and the two are different
   * access to the same bytes rather than two versions of one.
   */
  const nodesView = `corpus_${type.type}`;
  const edgesView = adjacency ? `corpus_${type.type}_edges` : undefined;
  await coordinator.exec(
    `CREATE OR REPLACE VIEW ${nodesView} AS SELECT * FROM read_parquet([${quoted(payloadFiles)}])`,
  );
  if (edgesView && edge) {
    await coordinator.exec(
      `CREATE OR REPLACE VIEW ${edgesView} AS
         SELECT * FROM read_parquet([${quoted(edge.projectionFiles(1, "src"))}])`,
    );
  }

  const source: DuckSource = {
    ...watching.api,

    publish(vertices) {
      publishSelection(reads, filterBy, fixed.id, vertices);
    },

    /**
     * How many vertices there are — **read, not probed.**
     *
     * The manifest declares `vertex_count`. What stood here was a note saying no manifest carries
     * it, and a doubling-then-bisecting `HEAD` search for the last chunk plus a
     * `parquet_file_metadata` read of its row count — about a dozen requests and a query, per
     * corpus, for a number already in hand.
     */
    async total() {
      if (type.count !== null) return Number(type.count);
      const rows = await meta(`SELECT count(*) AS n FROM ${nodesView}`);
      return Number(numbers(rows, "n")[0] ?? 0);
    },

    async extent() {
      const all = await load();
      return {
        xMin: Math.min(...all.map((b) => b.x0)),
        yMin: Math.min(...all.map((b) => b.y0)),
        xMax: Math.max(...all.map((b) => b.x1)),
        yMax: Math.max(...all.map((b) => b.y1)),
      };
    },

    // Regions only, said the same way `duckBoundedSource` says it: no `explore`. A neighbourhood
    // needs adjacency this source does not index, and fossil's `expand` is what answers it —
    // `ExploringSource` is the shape waiting for whoever writes that one.
    async slice(request: SliceRequest): Promise<Slice> {
      const { fill, limit, minLinkPixels, perPixel, pinned, r, signal, view } = request;
      const columns: Columns = { ...fixed, category: fill, size: r };
      const all = await load();
      /**
       * The tiles the rectangle touches — **and the far view is not a special case of this.**
       *
       * It used to be: past a zoom threshold the selection was replaced by every tile, because the
       * aggregate branch was going to read the whole relation anyway. A window that covers the
       * extent already intersects every box, so the branch was arithmetic restating itself, and it
       * is the reason `Viewport` carried a `zoom` at all.
       */
      const selected = intersecting(all, view);
      // Nothing selected is a legitimate answer — the camera is over empty space — and asking
      // `read_parquet([])` is a syntax error rather than an empty result. Checked before the files
      // are fetched, so an empty window costs no bytes at all.
      if (selected.length === 0) {
        return {
          n: 0,
          marks: 0,
          vertices: new BigUint64Array(0),
          positions: new Float32Array(0),
          links: new Float32Array(0),
          categories: new Uint16Array(0),
        };
      }

      /**
       * The URLs those tiles are in — **asked, not composed**, and distinct.
       *
       * `directions: ['src']` is the drawing read: every edge a window can draw has its source on
       * screen, therefore in one of these files. The answer says so — `complete: false` with a
       * `not-requested` gap for `dst`.
       */
      const addressed = addressing.tilesFor({
        type: type.type,
        tiles: selected,
        directions: ["src"],
      });
      // Both halves at once: the vertex files and the edge files a window touches are independent
      // reads, and the window is not drawable until both have landed.
      const [vertexFiles, edgeFiles] = await Promise.all([
        readable(addressed.vertexUrls),
        readable(addressed.edgeUrls),
      ]);
      /**
       * The camera moved while the tiles were arriving, so this question is already the wrong one.
       *
       * Checked here rather than left to the caller because of what comes next: the reads hold one
       * standing question each, so a request that resumes after the loop moved on would *supersede*
       * the newer one and reject it — the stale question winning the race against the live one.
       *
       * `signal.reason` and not a sentinel of ours: an aborted signal already carries what it was
       * aborted with, which for `AbortController.abort()` is a `DOMException` named `AbortError`.
       * Rethrowing it is the whole of the cancellation contract a source owes — see `SliceRequest`.
       */
      if (signal?.aborted) throw signal.reason;
      const nodes = `read_parquet([${vertexFiles.join(", ")}])`;
      // A corpus that declares no adjacency for this type still has to answer: the links query is
      // built either way, so what it reads is an empty relation of the right shape rather than a
      // `read_parquet([])`, which is a syntax error, or the vertex view, which has neither column.
      const relation =
        edgeFiles.length > 0
          ? `read_parquet([${edgeFiles.join(", ")}])`
          : `(SELECT NULL::BIGINT AS ${columns.source}, NULL::BIGINT AS ${columns.target} WHERE FALSE)`;

      // `nodes` twice, and the repetition is the statement: the relation this window reads *is* the
      // bytes the reader is holding, so the tiles that answer "what is in the rectangle" also answer
      // "where is the far end of an edge that leaves it".
      return watching.run(
        region(nodes, relation, columns, view, limit, 0, pinned, perPixel, minLinkPixels, nodes),
      );
    },
  };

  return { source, nodes: nodesView, edges: edgesView };
}
