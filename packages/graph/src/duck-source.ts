"use client";

import { clausePoints, column, fillColumn, numbers } from "@kanzo-tech/ui/analytics";
import type { Coordinator, FilterExpr, Selection } from "@kanzo-tech/ui/analytics";
import { BOUNDED_DEFAULTS, SUPERSEDED, type BoundedSource, type Slice, type SliceRequest, type Viewport } from "./bounded";
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
      const { fill, limit, perPixel, pinned, r, view } = request;
      const asked: Columns = { ...columns, category: fill, size: r };
      // No `held`: this source reads a relation rather than addressing bytes, so there is nothing
      // "already in hand" to draw a far end from — see `anchorCte`.
      return watching.run(
        region(nodes, edges, asked, view, limit, typeIndex, pinned, perPixel, undefined),
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
function longEnough(a: string, b: string, perPixel: number | undefined): string {
  if (perPixel === undefined || !Number.isFinite(perPixel) || perPixel <= 0) return "";
  const floor = BOUNDED_DEFAULTS.minLinkPixels * perPixel;
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
): string {
  const outside = both(`NOT (${spatial})`, filter);
  const long = longEnough("a", "b", perPixel);
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
  const near = longEnough("s", "t", perPixel);
  const anchors = (filter: FilterExpr) =>
    held ? anchorCte(held, edges, c, spatial, predicateSql(filter), perPixel) : "";

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
 * A corpus that fossil wrote, read by address.
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
 * const { source } = await openCorpus({ coordinator, dest: "/bench/1000000" });
 * ```
 *
 * **Addressed, not queried.** The manifest and the per-tile boxes are read once and kept; after that
 * a camera move is arithmetic over boxes and a list of URLs. There is deliberately no request on the
 * path between the camera moving and a URL being computable — the moment there is one, this has
 * become the `viewport` verb fossil deleted.
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

/** One tile's bounding box, from the footer. `null` for a tile whose statistics are missing. */
interface TileBox {
  tile: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * The manifests, flat enough to read with a line scan.
 *
 * A YAML library would be a dependency for six keys, and fossil's own checker makes the same call —
 * sixty lines that refuse what they cannot parse rather than guessing at it. This does the same: a
 * key it cannot find is an error naming the file, not a default that draws an empty graph.
 */
function scalar(yaml: string, key: string): string | undefined {
  const line = yaml.split("\n").find((row) => row.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, "");
}

function listItems(yaml: string, key: string): string[] {
  const rows = yaml.split("\n");
  const at = rows.findIndex((row) => row.startsWith(`${key}:`));
  if (at < 0) return [];
  const items: string[] = [];
  for (const row of rows.slice(at + 1)) {
    if (!row.startsWith("- ")) break;
    items.push(row.slice(2).trim());
  }
  return items;
}

async function manifest(dest: string, path: string): Promise<string> {
  const response = await fetch(`${dest}/${path}`);
  if (!response.ok) throw new Error(`corpus: ${path} is not readable (${response.status})`);
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
  const { coordinator, dest, filterBy, subjects = false, vertexType } = options;

  const reads = openReads(coordinator, filterBy);
  const meta = metaAsker(reads.meta);
  const watching = watcher(reads);

  const root = await manifest(dest, "graph.graph.yml");
  const vertexPaths = listItems(root, "vertices");
  const edgePaths = listItems(root, "edges");

  const vertices = await Promise.all(vertexPaths.map((p) => manifest(dest, p)));
  const wanted =
    vertexType === undefined
      ? vertices[0]
      : vertices.find((y) => scalar(y, "type") === vertexType);
  if (!wanted) {
    throw new Error(
      `corpus: no vertex type ${vertexType ?? "(none declared)"} in ${dest}/graph.graph.yml`,
    );
  }

  const type = scalar(wanted, "type");
  const prefix = scalar(wanted, "prefix");
  const chunkSize = Number(scalar(wanted, "chunk_size"));
  if (!type || !prefix || !Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error(`corpus: ${dest} declares no usable type, prefix and chunk_size`);
  }

  // The edge relation whose source is this vertex type. Its tiles are keyed by the same range as the
  // vertices — `src_chunk_size` equals the source type's `chunk_size`, and a different number there
  // would address nothing — which is what lets one tile set serve both relations.
  const edges = await Promise.all(edgePaths.map((p) => manifest(dest, p)));
  const edge = edges.find((y) => scalar(y, "src_type") === type);
  const edgePrefix = edge ? scalar(edge, "prefix") : undefined;

  /**
   * The boxes, and the one query this source makes that is not a slice.
   *
   * Read on first use rather than in the factory: a host that constructs a source and never draws
   * should not pay for it, and the cost is a footer read over every tile. Kept forever after —
   * tiles are precomputed and their boxes cannot move without the corpus being rewritten.
   *
   * **Held as the promise rather than as the answer**, which the move to one shared metadata client
   * forced and which was a latent defect before it: `total()` and `extent()` are called by different
   * effects with nothing ordering them, so two loads used to run concurrently and probe the whole
   * tile range twice.
   */
  let loading: Promise<TileBox[]> | null = null;
  let total: number | undefined;

  const tileUrl = (k: number) => `'${dest}/${prefix}chunk${k}.parquet'`;
  const edgeTileUrl = (k: number) => `'${dest}/${edgePrefix}by_source/tile${k}.parquet'`;

  /**
   * The tiles a window needs, held as bytes so that **panning back is free**.
   *
   * This is the one item on `BENCHMARKS.md`'s fix list that no amount of query tuning substitutes
   * for, and the measurement that puts it there is blunt: two of six drag steps at ten million
   * transfer zero new bytes and still cost 247 requests each, because every visit re-reads the same
   * footers and column chunks over HTTP. A tile fetched once and registered as a file is read from
   * memory forever after — no request, no range negotiation, no metadata round trip.
   *
   * **A tile address is what makes this possible at all**, and it is why the cache lives here rather
   * than in the render loop: a rectangle is a continuous key nothing can memoise, and a tile index is
   * a discrete one. `/docs/design/graph` argued the camera is addressed;
   * this is the first thing that spends the address on something.
   *
   * **The trade is honest and it is not free.** A registered tile is the *whole* tile, where DuckDB
   * over HTTP reads only the column chunks a query projects — so the first visit costs more bytes and
   * every later one costs none. Which way that nets out depends on tile size, which is the corpus's
   * to choose and not ours: at 122,880 rows a tile is about a megabyte, and at the 4,096 the request
   * arithmetic asks for it is about forty kilobytes.
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

  /** Registered tile name → how many bytes it is holding. Insertion order is the eviction order. */
  const resident = new Map<string, number>();
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
   * A tile is worth holding when it is **cheap to fetch whole** — 256 KB, and the number is measured.
   *
   * Registering a tile means downloading all of it, where DuckDB over HTTP reads only the column
   * chunks a query projects. On the million-node corpus a vertex tile is 74 KB and the edge tiles are
   * far larger, and caching both took a cold window from about 200 ms to **17,979 ms** while a repeat
   * of the same window fell to **11 ms**. Holding everything is a thousandfold win on revisit paid
   * for with an eighteen-second first paint, which is not a trade anybody would take.
   *
   * So the rule is a property of the tile rather than a flag: under the bar it is cached, over it the
   * URL is handed to DuckDB and the range reads happen as before. It also means the corpus decides —
   * `BENCHMARKS.md` asks for 4,096-row tiles on the request arithmetic alone, and at that size every
   * tile falls under this bar and the whole read path becomes cacheable without a line changing here.
   */
  const WORTH_HOLDING = 256 * 1024;

  /**
   * The names DuckDB should read these tiles from — registered buffers where possible, URLs where
   * not.
   *
   * Fetched concurrently, because a window is a handful of tiles and they are independent; a
   * sequential loop here would make the first paint the sum of its tiles rather than the slowest.
   */
  async function readable(kind: "vertex" | "edge", tiles: number[]): Promise<string[]> {
    const url = kind === "vertex" ? tileUrl : edgeTileUrl;
    const db = await registrar();
    if (!db) return tiles.map(url);
    const names = await Promise.all(
      tiles.map(async (k) => {
        const name = `corpus_${type}_${kind}_${k}.parquet`;
        if (resident.has(name)) return name;
        const address = url(k).slice(1, -1);
        // The size first, which is one metadata request against a body that may be megabytes — and
        // the same request the tile count already probes with, so the shape is not new here.
        const probe = await fetch(address, { method: "HEAD" });
        const size = Number(probe.headers.get("content-length"));
        if (!probe.ok || !Number.isFinite(size) || size > WORTH_HOLDING) return url(k);
        const response = await fetch(address);
        // A tile that will not load is not a reason to fail the whole window: fall back to the URL
        // and let DuckDB report whatever it finds there, which is the error a reader can act on.
        if (!response.ok) return url(k);
        const bytes = new Uint8Array(await response.arrayBuffer());
        await db.registerFileBuffer(name, bytes);
        resident.set(name, bytes.byteLength);
        held += bytes.byteLength;
        return name;
      }),
    );
    while (held > BUDGET && resident.size > 0) {
      const [oldest, size] = resident.entries().next().value as [string, number];
      // Never evict a tile this very window is about to read, or the query reads a dropped file.
      if (names.includes(oldest)) break;
      resident.delete(oldest);
      held -= size;
      await db.dropFile(oldest);
    }
    return names.map((n) => (n.startsWith("'") ? n : `'${n}'`));
  }

  function load(): Promise<TileBox[]> {
    loading ??= (async () => {
      /**
       * How many tiles there are, without listing anything.
       *
       * `ceil(V / chunk_size)` is the published arithmetic and it needs `V`, which **no manifest
       * carries** — the vertex YAML declares the type, the prefix and the chunk size and stops. So
       * the count has to come from the tiles themselves, and the obvious route is the one that does
       * not work: `read_parquet('…/chunk*.parquet')` expands a glob, expanding a glob lists a
       * directory, and a plain HTTP origin has no listing. It succeeds against a local path and
       * against a bucket, which is what makes the mistake easy to keep.
       *
       * So the last tile is found by probing — double until a `HEAD` misses, then bisect. That is
       * about a dozen requests once for a corpus of any size, and every one of them is a request a
       * plain origin can answer.
       */
      const exists = async (k: number) =>
        (await fetch(`${dest}/${prefix}chunk${k}.parquet`, { method: "HEAD" })).ok;
      if (!(await exists(0))) throw new Error(`corpus: ${dest}/${prefix} holds no chunk0`);
      let low = 0;
      let high = 1;
      while (await exists(high)) {
        low = high;
        high *= 2;
      }
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (await exists(mid)) low = mid;
        else high = mid;
      }
      const tiles = low + 1;
      // The last tile is short unless the count divides evenly, and its footer says by how much —
      // metadata only, so this reads no column.
      const tail = await meta(
        `SELECT num_rows AS n FROM parquet_file_metadata('${tileUrl(low).slice(1, -1)}')`,
      );
      total = low * chunkSize + Number(numbers(tail, "n")[0] ?? 0);
      const urls = Array.from({ length: tiles }, (_, k) => tileUrl(k)).join(", ");
      /**
       * `min_value`/`max_value`, never `min`/`max`.
       *
       * Parquet's original statistics fields are defined by *signed* byte comparison, which is
       * meaningless for an unsigned column — a writer that gets this right leaves them empty. A
       * reader that only knows the deprecated pair concludes the footer carries no box for the column
       * the whole address is built on. `coalesce` keeps the float columns working either way.
       */
      const stats = await meta(
        `SELECT CAST(regexp_extract(file_name, 'chunk(\\d+)', 1) AS INTEGER) AS tile,
           min(CASE WHEN path_in_schema = 'x' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS x0,
           max(CASE WHEN path_in_schema = 'x' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS x1,
           min(CASE WHEN path_in_schema = 'y' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS y0,
           max(CASE WHEN path_in_schema = 'y' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS y1
         FROM parquet_metadata([${urls}])
         WHERE path_in_schema IN ('x', 'y') GROUP BY 1 ORDER BY 1`,
      );
      const tile = numbers(stats, "tile");
      const [x0, x1, y0, y1] = ["x0", "x1", "y0", "y1"].map((f) => numbers(stats, f));
      return tile.map((t, i) => ({
        tile: t as number,
        x0: x0?.[i] as number,
        x1: x1?.[i] as number,
        y0: y0?.[i] as number,
        y1: y1?.[i] as number,
      }));
    })();
    return loading;
  }

  /** The tiles a rectangle touches. Pure — this is the whole of the addressing, and it makes no call. */
  function intersecting(all: TileBox[], view: Viewport): number[] {
    return all
      .filter((b) => b.x1 >= view.xMin && b.x0 <= view.xMax && b.y1 >= view.yMin && b.y0 <= view.yMax)
      .map((b) => b.tile);
  }

  /**
   * Everything the corpus fixes, and nothing it does not.
   *
   * `dense_id`, `subject`, `x` and `y` are facts of the format — a corpus has them under those
   * names or it is not one. What colours and what sizes are channels, so they arrive with the
   * request and are filled in per slice.
   */
  const fixed = {
    id: "dense_id",
    subject: subjects ? "subject" : undefined,
    x: "x",
    y: "y",
    source: "src_dense",
    target: "dst_dense",
  } as const;

  /**
   * The relation half, registered once at open.
   *
   * A view rather than a table: `CREATE TABLE AS` would pull the corpus into memory, which is the
   * working set the whole bounded path exists to refuse. A view leaves the bytes where they are and
   * lets each query fetch the ranges it needs.
   *
   * Over **every** tile, deliberately — this is the surface that answers *what does it mean*, and a
   * count, a histogram or a crossfilter clause is a question about the corpus rather than about the
   * window. The addressed reading is `slice`, beside it, and the two are different access to the
   * same bytes rather than two versions of one.
   */
  const nodesView = `corpus_${type}`;
  const edgesView = edgePrefix ? `corpus_${type}_edges` : undefined;
  const allTiles = async () => {
    const boxes = await load();
    return boxes.map((b) => tileUrl(b.tile)).join(", ");
  };
  await coordinator.exec(
    `CREATE OR REPLACE VIEW ${nodesView} AS SELECT * FROM read_parquet([${await allTiles()}])`,
  );
  if (edgesView) {
    await coordinator.exec(
      `CREATE OR REPLACE VIEW ${edgesView} AS
         SELECT * FROM read_parquet('${dest}/${edgePrefix}by_source.parquet')`,
    );
  }

  const source: DuckSource = {
    ...watching.api,

    publish(vertices) {
      publishSelection(reads, filterBy, fixed.id, vertices);
    },

    async total() {
      await load();
      return total ?? 0;
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
      const { fill, limit, perPixel, pinned, r, signal, view } = request;
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
      // `read_parquet([])` is a syntax error rather than an empty result. Checked before the tiles
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

      // Both halves at once: the vertex tiles and the edge tiles a window touches are independent
      // reads, and the window is not drawable until both have landed.
      const [vertexTiles, edgeTiles] = await Promise.all([
        readable("vertex", selected),
        readable("edge", edgePrefix ? selected : []),
      ]);
      /**
       * The camera moved while the tiles were arriving, so this question is already the wrong one.
       *
       * Checked here rather than left to the caller because of what comes next: the reads hold one
       * standing question each, so a request that resumes after the loop moved on would *supersede*
       * the newer one and reject it — the stale question winning the race against the live one.
       */
      if (signal?.aborted) throw SUPERSEDED;
      const nodes = `read_parquet([${vertexTiles.join(", ")}])`;
      const relation = `read_parquet([${edgeTiles.join(", ")}])`;

      // `nodes` twice, and the repetition is the statement: the relation this window reads *is* the
      // bytes the reader is holding, so the tiles that answer "what is in the rectangle" also answer
      // "where is the far end of an edge that leaves it".
      return watching.run(
        region(nodes, relation, columns, view, limit, 0, pinned, perPixel, nodes),
      );
    },
  };

  return { source, nodes: nodesView, edges: edgesView };
}
