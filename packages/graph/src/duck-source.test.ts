import { describe, expect, it } from "vitest";
import { Coordinator, Selection } from "@kanzo-tech/ui/analytics";
import { duckBoundedSource } from "./duck-source";
import { vertexId } from "./resident";

/**
 * What a slice actually asks the database, and what it no longer asks it twice.
 *
 * Two claims live here and they are the two the greyout used to stand in for.
 *
 * **The page's filters are in the drawing query.** They used to be a second question — *which of the
 * million ids survive?* — whose answer was carried back into JavaScript and turned into a mask.
 * Measured on `/bench/1000000` in the browser on 2026-08-17: 377 ms for the survivor scan, 43 ms to
 * widen a million ids into identities and 30 ms to look them up, per filter change, to shade a
 * picture of at most twenty thousand marks. The predicate costs nothing here because the query was
 * running anyway — the same window measured 8.4 ms filtered against 12.0 ms unfiltered, because
 * fewer rows survive to be numbered.
 *
 * **A detail slice is two queries, not three.** `SELECT count(*) … WHERE <the same predicate>` was a
 * second scan to learn a number the first scan had already computed: `row_number() OVER (ORDER BY
 * id)` sorts the whole matching set, and a window function is evaluated before `LIMIT`, so
 * `count(*) OVER ()` is the matched count on every row. Measured on the same corpus: a pan's queries
 * finished at 29.0 ms with the third and 25.1 ms without it.
 *
 * ## What this cannot prove
 *
 * - **That any of this SQL is valid.** The connector below answers every string with the same rows,
 *   so a query DuckDB would reject reads as a pass here. Only the browser runs it against an engine
 *   — `docs/showcases/graph-bench`, and the figures above were taken there.
 * - **That `count(*) OVER ()` is evaluated before `LIMIT`.** That is DuckDB's semantics, asserted by
 *   *equality with the number the deleted query returned* — 28,424 matched, both ways, on the
 *   million-node corpus — and not by anything in this file.
 * - **Nothing about `openCorpus`.** It fetches manifests over HTTP before it queries anything, so
 *   its half of this shape is exercised by the showcase rather than here. What is shared is
 *   `region`, `visibleCte` and `watcher`, which is what makes the coverage worth having at all.
 * - **That the sample is spatially stratified, or that it is a sample at all.** `id % stride = 0`
 *   over a Morton-ordered `dense_id` is the claim, and no stub can evaluate a modulo. What runs it
 *   is `docs/showcases/graph-bench`, and the far-view figures on `/docs/design/graph` were taken
 *   there.
 * - **Anything at all about the anchor branch, which is the larger half of this change.** `out`,
 *   `span` and `anchor` are only built when a source says what bytes it is holding, and the only
 *   source that can is `openCorpus` — which fetches manifests over HTTP before it queries. So what
 *   is asserted below is the *absence* of that branch for a relation source, which is the claim that
 *   belongs here: a relation has nothing in hand, and building it there would join the whole node
 *   table twice per camera move. That it produces the right picture is
 *   `graph-model.test.ts`, "draws the far end of an edge that leaves the window", which runs the same
 *   rule in JavaScript over arrays, plus the browser figures on `/docs/design/graph`.
 */

function harness() {
  const asked: string[] = [];
  const connector = {
    query: ({ sql }: { sql: string }) => {
      asked.push(sql);
      // One row, in the shape both reads answer in: `column`/`fillColumn` fall back to iterating
      // plain objects when there is no Arrow child, which is what makes a stub possible at all.
      return Promise.resolve([
        {
          local: 0,
          id: 3,
          x: 1,
          y: 2,
          category: 0,
          matched: 41,
          mark: 1,
          src: 0,
          dst: 0,
          weight: 1,
        },
      ]);
    },
  };
  const coordinator = new Coordinator(connector as never, {
    logger: null,
    consolidate: false,
    cache: false,
  });
  return { asked, coordinator };
}

const WINDOW = {
  view: { xMin: 0, yMin: 0, xMax: 10, yMax: 10 },
  limit: 100,
};

describe("a duck source's slice", () => {
  it("carries the page's predicate into the query that draws", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const source = duckBoundedSource({
      coordinator,
      filterBy: crossfilter,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });
    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "beast",
      predicate: "kind = 'beast'",
    } as never);

    await source.slice(WINDOW);
    // Both reads, because the edge join is over the same visible set: a slice that filtered its
    // points and not its links would draw edges to vertices it did not return.
    expect(asked.filter((sql) => sql.includes("kind = 'beast'"))).toHaveLength(2);
  });

  it("asks two questions where it used to ask three", async () => {
    const { asked, coordinator } = harness();
    const source = duckBoundedSource({
      coordinator,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });
    const slice = await source.slice(WINDOW);

    expect(asked).toHaveLength(2);
    // The number the deleted query used to return, read off the column the surviving one carries.
    expect(slice.n).toBe(41);
    expect(asked.some((sql) => sql.includes("count(*) OVER () AS matched"))).toBe(true);
    // The shape of the query that is gone. `count(*)` on its own still appears — inside the window —
    // so what is asserted is the *statement*, which began with a bare select.
    expect(asked.some((sql) => sql.trimStart().startsWith("SELECT count(*)"))).toBe(false);
  });

  /**
   * Both reads select the same rows, and the stride is why that has to be said out loud.
   *
   * The sample is a predicate over `matched`, which is a window aggregate — so the links read has to
   * compute the same count the points read does, or the two CTEs name different sets and the slice
   * draws edges to vertices it did not return. That is the one thing this stub *can* check: the
   * texts are two halves of one question, and they have to agree about the question.
   */
  it("takes the same sample in both reads, so the links land on points that came back", async () => {
    const { asked, coordinator } = harness();
    const source = duckBoundedSource({ coordinator, nodes: "nodes", edges: "edges", typeIndex: 0 });
    await source.slice(WINDOW);

    const [points, links] = asked;
    const stride = /WHERE id % (greatest\(1, [^)]*\)[^=]*) = 0/;
    expect(points).toMatch(stride);
    expect(links).toMatch(stride);
    expect(stride.exec(points as string)?.[1]).toBe(stride.exec(links as string)?.[1]);
    // The divisor is the request's own limit, so a window that fits is not sampled — `id % 1 = 0`.
    expect(points).toContain("ceil(matched / 100.0)");
  });

  /**
   * An edge under three screen pixels is not sent, and the threshold is a length in space.
   *
   * Two of every three edges a five-million-node window draws are under one pixel — a dot on top of
   * two dots the point layer has already drawn. Discarding them sends 27.5–35.3% of the rows for a
   * 0.1% difference in inked pixels (`.planning/FAR-VIEW-AND-EDGES.md`). The window here is 10 units
   * wide and `perPixel` is 0.5, so three pixels is 1.5 units and the predicate compares against
   * 2.25 — squared, because squaring both sides of a distance comparison removes a `sqrt` per row and
   * changes no answer.
   *
   * **A row discard, not `linkVisibilityDistanceRange`.** That is a renderer uniform that *dims* a
   * short link, and dimming happens after the row has been joined, returned, uploaded and
   * rasterised. Asserting on the predicate is what tells the two apart.
   */
  it("does not send an edge shorter than three screen pixels", async () => {
    const { asked, coordinator } = harness();
    const source = duckBoundedSource({ coordinator, nodes: "nodes", edges: "edges", typeIndex: 0 });
    await source.slice({ ...WINDOW, perPixel: 0.5 });

    const links = asked.find((sql) => sql.includes("AS src"))!;
    expect(links).toContain(">= 2.25");
    expect(links).toContain("(s.x - t.x) * (s.x - t.x) + (s.y - t.y) * (s.y - t.y)");
    // On the links read and nowhere else: a point is not an edge and has no length.
    expect(asked.filter((sql) => sql.includes(">= 2.25"))).toHaveLength(1);
  });

  /**
   * No resolution, no discard — because a threshold in pixels with no pixels is not a threshold.
   *
   * The loop asks for `EVERYTHING` when a corpus fits under the limit, and that request comes from no
   * canvas and carries no rectangle. A defaulted `perPixel` would make that path silently drop the
   * short edges of a graph small enough that every edge is worth drawing.
   */
  it("discards nothing when the caller said nothing about resolution", async () => {
    const { asked, coordinator } = harness();
    const source = duckBoundedSource({ coordinator, nodes: "nodes", edges: "edges", typeIndex: 0 });
    await source.slice(WINDOW);

    const links = asked.find((sql) => sql.includes("AS src"))!;
    expect(links).not.toContain("(s.x - t.x)");
    expect(links.slice(links.indexOf("SELECT s.local"))).not.toContain("WHERE");
  });

  /**
   * A relation source has nothing in hand, and says so by building no anchor branch.
   *
   * A corpus fetches the tiles a rectangle touches, and those tiles hold the vertices just outside it
   * — which is what lets the far end of an edge that leaves the window be drawn for no extra byte. A
   * plain relation fetches nothing: `held` there would be the whole node table, and the join would
   * scan the corpus twice on every camera move, which is the unbounded pattern wearing a bounded
   * interface. The difference is a parameter rather than a flag, and this is what checks it stayed
   * one.
   */
  it("builds no far-end branch for a source that holds no bytes", async () => {
    const { asked, coordinator } = harness();
    const source = duckBoundedSource({ coordinator, nodes: "nodes", edges: "edges", typeIndex: 0 });
    await source.slice({ ...WINDOW, perPixel: 0.5 });

    for (const sql of asked) {
      expect(sql).not.toContain("anchor");
      expect(sql).not.toContain("span");
      expect(sql).not.toContain("NOT (");
    }
    // Both ends still have to be in the sample, which is the shape that loses the edge.
    expect(asked.some((sql) => sql.includes("JOIN vis s") && sql.includes("JOIN vis t"))).toBe(true);
  });

  /**
   * A pin says *where to look*; the filters say *what exists*. Written the other way round —
   * `bbox AND filter OR pinned` — a pinned node survives a filter that excludes it, and the canvas
   * draws a vertex the rest of the page has agreed is not there.
   */
  it("does not let a pinned vertex escape the page's filters", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const source = duckBoundedSource({
      coordinator,
      filterBy: crossfilter,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });
    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "beast",
      predicate: "kind = 'beast'",
    } as never);

    await source.slice({ ...WINDOW, pinned: [vertexId(0, 7)] });
    const points = asked.find((sql) => sql.includes("row_number()"))!;
    const where = points.slice(points.indexOf("WHERE"), points.indexOf("LIMIT"));
    // The pin widens the rectangle and the filter narrows the result of that — one `AND` with the
    // whole spatial term, pin included, on its left.
    expect(where).toContain("id IN (7)");
    expect(where.indexOf("kind = 'beast'")).toBeGreaterThan(where.indexOf("id IN (7)"));
    expect(where.slice(where.indexOf("id IN (7)"))).toContain("AND");
  });

  /**
   * How big the corpus is, and where it is, are facts about the corpus. Filtered, the view's own
   * "20,000 of 1,000,000" becomes a fraction of itself and stops being the one number a bounded
   * renderer owes its reader honestly.
   *
   * **Asserted by re-query and not by SQL text**, and the difference is what a first version of
   * this missed: the metadata builder ignores the filter it is handed, so handing it a crossfilter
   * changes no query *string* — it changes who the coordinator walks. A read with a `filterBy` is
   * re-run on every selection change, and its answer goes nowhere.
   */
  it("keeps the crossfilter out of the questions that are about the corpus", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const source = duckBoundedSource({
      coordinator,
      filterBy: crossfilter,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });

    await source.total?.();
    await source.extent?.();
    const settled = asked.length;

    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "beast",
      predicate: "kind = 'beast'",
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(asked.length).toBe(settled);
    expect(asked.some((sql) => sql.includes("kind = 'beast'"))).toBe(false);
  });

  /**
   * The reader's own gesture filters everything except the picture it was made on.
   *
   * `IdSetClient` declines this exemption on purpose and says why: it *fades* an excluded row, so
   * the row is still there and the fade is the brush. A canvas that draws what survives cannot
   * decline it — a lasso would answer by deleting everything outside the lasso.
   */
  it("exempts the graph from the clause the graph publishes", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const source = duckBoundedSource({
      coordinator,
      filterBy: crossfilter,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });
    await source.slice(WINDOW);
    source.publish([vertexId(0, 3), vertexId(0, 9)]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Published, so the rest of the page sees it…
    expect(String(crossfilter.predicate())).toContain("IN (3, 9)");
    // …and not applied to the picture it came from.
    expect(asked.some((sql) => sql.includes("IN (3, 9)"))).toBe(false);
  });

  /**
   * The push half: a filter change produces a finished slice, not a nudge to ask again.
   *
   * The coordinator has already re-run both reads with the new predicate by the time anything here
   * hears about it, so asking again would issue those two queries a second time to learn what is
   * already in hand.
   */
  it("hands the loop a whole slice when the page filters, without being asked", async () => {
    const { coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const source = duckBoundedSource({
      coordinator,
      filterBy: crossfilter,
      nodes: "nodes",
      edges: "edges",
      typeIndex: 0,
    });
    const answers: number[] = [];
    const release = source.watch!((slice) => answers.push(slice.vertices.length));
    await source.slice(WINDOW);

    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "beast",
      predicate: "kind = 'beast'",
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(answers).toEqual([1]);
    release();
  });
});
