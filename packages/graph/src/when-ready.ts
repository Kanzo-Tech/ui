import type { Graph } from "@cosmos.gl/graph";

/**
 * **Every write into cosmos.gl goes through here, because a non-null instance is not a usable one.**
 *
 * cosmos.gl 3.x builds its device asynchronously. The constructor returns immediately and
 * `graphRef.current` is set, but for tens of milliseconds — longer when several graphs mount on one
 * page — the instance has no points, no links and no config to change. What happens then is not one
 * failure mode but two, and the quiet one is worse:
 *
 * - `setPointPositions` **throws** `Cannot set properties of undefined (setting 'shouldSkipRescale')`.
 *   React swallows it into the effect boundary, so it reaches the console and nothing else.
 * - `setPointColors`, `setPointSizes`, `setConfigPartial` and `fitViewByPointPositions` **do not**.
 *   They raise a dirty flag on something that is not there and return, so the picture is simply
 *   never uploaded: a blank canvas beside a badge reporting a full slice, with `onFailure` silent
 *   and nothing in the console at all.
 *
 * Measured on `/docs/graph`, where three graphs mount together and none of them drew a single point.
 * Upstream states the contract in its own `.d.ts` for `findPointsInRect` and `findPointsInPolygon`
 * — *must only be called when the graph is ready* — and it holds for every setter too.
 *
 * **The rule is a helper rather than five `await`s** because it was broken at five call sites in
 * four modules, which is what `CONVENTIONS.md` means by a rule that has to become a test.
 * `when-ready.test.ts` is that test, and it reads the source rather than the behaviour.
 *
 * **`ready` has no failure path.** When the device cannot be made, cosmos.gl does not reject — the
 * promise simply never settles, so `apply` never runs and the canvas stays empty. That is the state
 * `hasWebGL()` in `use-cosmos-graph.ts` probes for before any of this, and it is why this returns a
 * cancel rather than being awaited: nothing here may hold a caller open.
 *
 * @returns a cancel. Call it from an effect's cleanup — during a pan the slices arrive faster than
 *   a frame, and every one but the last is superseded before it could have been drawn.
 */
export function whenReady(graph: Graph, apply: (graph: Graph) => void): () => void {
  let live = true;
  void graph.ready.then(() => {
    if (live) apply(graph);
  });
  return () => {
    live = false;
  };
}

/**
 * Whether this instance's device has arrived, answered **synchronously**.
 *
 * For the two call sites that cannot wait: `findPointsInRect` and `findPointsInPolygon` run inside a
 * pointer handler and have to return a number, and upstream marks exactly those two — and nothing
 * else in its `.d.ts` — *must only be called when the graph is ready*.
 *
 * The flag is kept beside the instance rather than on it, in a `WeakSet`, because the promise is the
 * only thing cosmos.gl exposes and a promise cannot be asked whether it has settled. A graph that is
 * never asked about is never added, which costs one `false` and one hit test that selects nothing.
 */
const arrived = new WeakSet<Graph>();

export function isReady(graph: Graph): boolean {
  if (arrived.has(graph)) return true;
  void graph.ready.then(() => arrived.add(graph));
  return false;
}
