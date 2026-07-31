import { describe, expect, it } from "vitest";
import type { Coordinator } from "@kanzo-tech/ui/analytics";
import { LOOKS } from "./graph-looks";
import {
  buffers,
  load,
  neighboursOf,
  scaleOf,
  SPACE,
  type GraphSpec,
  type Loaded,
  type NodeRow,
} from "./graph-model";

/**
 * What is worth asserting without a GPU, and what is not.
 *
 * `load` and `buffers` are the two functions the benchmark says cost real time, and both are pure
 * arithmetic over arrays — testable, and the place a regression would hide. What is *not* asserted
 * here is colour: jsdom cannot resolve `color-mix(in srgb, var(--token) 100%, transparent)`, so
 * every token comes back as the same fallback. Asserting a hex here would be asserting jsdom's
 * limitations. The browser checks that, on the showcase and on the benchmark route.
 */

/**
 * A coordinator that answers each `onceQuery` in turn.
 *
 * `load` issues two reads — nodes, then edges — and Mosaic's client protocol is `connect(client)`
 * followed by `client.queryResult(data)`. Answering in order is enough, and it keeps the fixture
 * from having to parse the SQL to work out which read it is looking at.
 */
function coordinatorAnswering(...results: unknown[]): Coordinator & { sql: string[] } {
  let next = 0;
  const sql: string[] = [];
  return {
    sql,
    connect(client: { query(): unknown; queryResult(data: unknown): unknown }) {
      sql.push(String(client.query()));
      const answer = results[next++];
      queueMicrotask(() => client.queryResult(answer));
    },
    disconnect() {},
  } as unknown as Coordinator & { sql: string[] };
}

const SPEC: GraphSpec = {
  table: "nodes",
  edges: "edges",
  idField: "id",
  labelField: "label",
  categoryField: "kind",
  sizeField: "degree",
  groupField: "team",
};

/**
 * Rows as the *database* returns them, which is under `load`'s aliases and not the spec's column
 * names: the query is `SELECT kind AS category, degree AS size, …`. Writing the fixture in `kind`
 * and `degree` is how the first draft of this file silently tested nothing — every field read back
 * as `undefined`, and `text()` turned each one into `""` without complaint.
 *
 * Ids are sparse and out of step with position on purpose, because that is what makes the index
 * `Map` do any work at all.
 */
const NODES = [
  { id: 10, label: "a", category: "dataset", size: 4, group: "red" },
  { id: 25, label: "b", category: "keyword", size: 1, group: "blue" },
  { id: 41, label: "c", category: "dataset", size: 9, group: "" },
];

const EDGES = [
  { source: 10, target: 41 },
  { source: 25, target: 41 },
];

/**
 * A complete `Loaded`, because `buffers` takes one and a partial cast does not typecheck — which is
 * exactly why `typecheck` runs beside `test`: vitest never looks at the types, so a fixture that
 * lies about its shape passes the suite and fails the compiler.
 */
function loadedFixture(rows: NodeRow[]): Loaded {
  const n = rows.length;
  return {
    ids: rows.map((r) => r.id),
    index: new Map(rows.map((r, i) => [r.id, i])),
    rows,
    positions: new Float32Array(n * 2),
    clusters: rows.map(() => undefined),
    links: new Float32Array([]),
    minSize: Math.min(...rows.map((r) => r.size)),
    maxSize: Math.max(...rows.map((r) => r.size)),
    ranked: rows.map((_, i) => i),
    categories: [...new Set(rows.map((r) => r.category))],
  };
}

describe("load", () => {
  it("indexes ids to positions, and remaps links through that index", async () => {
    const data = await load(coordinatorAnswering(NODES, EDGES), SPEC);

    expect(data.ids).toEqual([10, 25, 41]);
    expect(data.index.get(41)).toBe(2);
    // The link buffer speaks in *point indices*, never in database ids — the whole reason the Map
    // exists. `10 → 41` is `0 → 2`.
    expect(Array.from(data.links)).toEqual([0, 2, 1, 2]);
  });

  it("treats a blank group as no group rather than group zero", async () => {
    const data = await load(coordinatorAnswering(NODES, EDGES), SPEC);

    // A vertex shared by every group belongs to none; left unclustered it drifts between the ones
    // it joins, which is the behaviour `undefined` buys and `0` silently destroys.
    expect(data.clusters).toEqual([0, 1, undefined]);
  });

  it("discovers the category vocabulary in first-seen order rather than declaring it", async () => {
    const data = await load(coordinatorAnswering(NODES, EDGES), SPEC);

    expect(data.categories).toEqual(["dataset", "keyword"]);
  });

  it("ranks by descending size, because the label budget spends from the front", async () => {
    const data = await load(coordinatorAnswering(NODES, EDGES), SPEC);

    expect(data.ranked).toEqual([2, 0, 1]);
    expect(data.minSize).toBe(1);
    expect(data.maxSize).toBe(9);
  });

  it("seeds positions into the middle half of the space", async () => {
    const data = await load(coordinatorAnswering(NODES, EDGES), SPEC);

    // Gravity pulls to the centre, so starting at the full extent would open with a collapse
    // rather than a layout.
    for (const value of data.positions) {
      expect(value).toBeGreaterThanOrEqual(SPACE * 0.25);
      expect(value).toBeLessThanOrEqual(SPACE * 0.75);
    }
  });

  it("renders a DATE cell as text instead of handing React a Date", async () => {
    // Detail columns are aliased `d_<field>`, so that is the key the row comes back under.
    const withDate = [{ ...NODES[0], d_issued: new Date("2019-10-02T00:00:00Z") }];
    const spec: GraphSpec = { ...SPEC, detailFields: [{ field: "issued", label: "Issued" }] };

    const data = await load(coordinatorAnswering(withDate, []), spec);

    // A `Date` reaching JSX crashes with "Objects are not valid as a React child".
    expect(data.rows[0]?.details).toEqual([{ label: "Issued", value: "2019-10-02" }]);
  });

  it("reads the spec's column names, never a hardcoded schema", async () => {
    const coordinator = coordinatorAnswering(NODES, EDGES);

    await load(coordinator, SPEC);

    // The whole point of `GraphSpec`: point the canvas at another relation and it is a change of
    // argument, not of code. The proof is in the SQL — the domain's names appear there and the
    // renderer's names do not appear anywhere else.
    expect(coordinator.sql[0]).toContain("kind");
    expect(coordinator.sql[0]).toContain("degree");
    expect(coordinator.sql[0]).toContain("team");
    expect(coordinator.sql[0]).toContain('FROM "nodes"');
    expect(coordinator.sql[1]).toContain('FROM "edges"');
  });
});

describe("buffers", () => {
  it("writes one RGBA, one size and one shape per point", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const data = {
      ...loadedFixture(NODES.map((n) => ({ ...n, details: [] }))),
      links: new Float32Array([0, 2, 1, 2]),
    };

    const gpu = buffers(data, LOOKS.atlas, host);

    expect(gpu.colors).toHaveLength(3 * 4);
    expect(gpu.sizes).toHaveLength(3);
    expect(gpu.shapes).toHaveLength(3);
    expect(gpu.linkColors).toHaveLength(2 * 4);
  });

  it("ramps radius by the square root of size, so a heavy tail does not flatten", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const data = loadedFixture(
      [1, 4, 9].map((size, i) => ({
        id: i,
        label: `n${i}`,
        category: "dataset",
        size,
        group: "",
        details: [],
      })),
    );

    const [lo, hi] = LOOKS.atlas.form.size;
    const gpu = buffers(data, LOOKS.atlas, host);

    // √1 and √9 are the ends; √4 sits at (2−1)/(3−1) = 0.5 of the way, which a linear ramp would
    // have put at (4−1)/(9−1) = 0.375 — the difference between a readable spread and everything
    // but the biggest hubs pinned to the floor.
    expect(gpu.sizes[0]).toBeCloseTo(lo, 5);
    expect(gpu.sizes[2]).toBeCloseTo(hi, 5);
    expect(gpu.sizes[1]).toBeCloseTo(lo + 0.5 * (hi - lo), 5);
  });

  it("leaves link alpha at 1, because that channel is reserved", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const data = {
      ...loadedFixture(NODES.map((n) => ({ ...n, details: [] }))),
      links: new Float32Array([0, 2, 1, 2]),
    };

    const gpu = buffers(data, LOOKS.atlas, host);

    // Opacity is a uniform (`appearance`). Multiplying it in here is what once cost a 17,472-byte
    // re-upload on every tick of a slider, and the channel is kept free for a datum that genuinely
    // differs per link — weight, confidence, recency.
    expect(gpu.linkColors[3]).toBe(1);
    expect(gpu.linkColors[7]).toBe(1);
  });
});

describe("scaleOf", () => {
  it("gives an unknown category and the overflow one the same Other glyph", () => {
    const scale = scaleOf(LOOKS.ink, ["a", "b", "c", "d", "e"]);

    // `indexOf` answers −1 for a category the data does not contain and the shape order runs out at
    // four, so both land on Other. Falling back to `circle` would have handed the fifth category
    // the glyph the first one already wears.
    expect(scale.shape("nope")).toBe(scale.shape("e"));
  });

  it("collapses to one colour when the look encodes identity as shape", () => {
    const scale = scaleOf(LOOKS.ink, ["a", "b"]);

    expect(scale.color("a")).toBe(scale.color("b"));
    expect(scale.shape("a")).not.toBe(scale.shape("b"));
  });
});

describe("neighboursOf", () => {
  it("walks both directions, because an edge is a neighbour either way round", () => {
    // The pairs are cosmos.gl's own `[otherPointIndex, linkIndex]`.
    const graph = {
      graph: {
        sourceIndexToTargetIndices: [[[2, 0]], [[2, 1]], undefined],
        targetIndexToSourceIndices: [undefined, undefined, [[0, 0], [1, 1]]],
      },
    } as unknown as Parameters<typeof neighboursOf>[0];

    expect(neighboursOf(graph, 0)).toEqual([2]);
    expect(neighboursOf(graph, 2)).toEqual([0, 1]);
  });

  it("answers empty for a point with no edges instead of throwing", () => {
    const graph = {
      graph: { sourceIndexToTargetIndices: undefined, targetIndexToSourceIndices: undefined },
    } as unknown as Parameters<typeof neighboursOf>[0];

    expect(neighboursOf(graph, 7)).toEqual([]);
  });
});
