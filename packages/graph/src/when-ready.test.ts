import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **No module writes into cosmos.gl outside `whenReady`.**
 *
 * The rule this pins is in `when-ready.ts`: a cosmos.gl instance exists before its device does, and
 * a call that lands in between either throws where React swallows it or — worse, and this is the
 * majority — raises a dirty flag on nothing and returns. **It was broken at nine call sites across
 * five modules**, all of them written independently and all of them plausible, which is what
 * `CONVENTIONS.md` means by a rule that has to stop being remembered.
 *
 * What it cost: three graphs on `/docs/graph` mounting together and none of them drawing a point,
 * with a badge beside each reporting a full slice, `onFailure` silent, and one line in the console
 * that named neither the cause nor the module. Two hours to find, and the wrong answer twice on the
 * way — the first two diagnoses were about label tracking and about the environment's WebGL, both
 * supported by real measurements taken off a canvas that had never painted.
 *
 * ## What this guard cannot prove
 *
 * - **It matches by name, not by type.** A variable called `graph` calling a method in the list
 *   below is the whole test. A cosmos.gl instance held under another name is invisible to it, and
 *   so is a method upstream adds tomorrow — which is what `SETTERS` being a *floor* is for: if the
 *   count of matched calls ever drops to zero the extraction has stopped working, and that fails
 *   here rather than passing empty.
 * - **It does not check the cancel is used.** `whenReady` returns one so an effect can drop a
 *   superseded write, and a call site that ignores it passes. **Nothing else holds that half
 *   either** — the test written for it flaked one run in six and was deleted rather than kept, and
 *   `use-bounded-graph.test.tsx` records why.
 * - **It says nothing about `isReady`.** The two hit tests answer synchronously and are guarded by
 *   the predicate instead; that they are is asserted below by name, which is as far as a text scan
 *   can go.
 */

const SRC = dirname(fileURLToPath(import.meta.url));

/**
 * The methods that reach the device. Not upstream's whole surface — the readers (`getZoomLevel`,
 * `spaceToScreenPosition`, `screenToSpacePosition`) are on the store and answer before the device,
 * which is why the query loop can ask where the camera is on the first frame.
 */
const SETTERS = [
  "setPointPositions",
  "setLinks",
  "setPointColors",
  "setPointSizes",
  "setPointShapes",
  "setLinkColors",
  "setPointClusters",
  "setClusterPositions",
  "setConfigPartial",
  "trackPointPositionsByIndices",
  "fitView",
  "fitViewByPointPositions",
  "render",
  "start",
];

/** The two upstream marks *must only be called when the graph is ready*, and they cannot wait. */
const SYNCHRONOUS = ["findPointsInRect", "findPointsInPolygon"];

const sources = readdirSync(SRC)
  .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test.") && name !== "when-ready.ts")
  .map((name) => ({ name, text: readFileSync(join(SRC, name), "utf8") }));

/** A call on a bare `graph` — the name the unguarded sites all used. Inside `whenReady` the
 *  parameter is `ready`, which is the whole point of renaming it there. */
const unguarded = (text: string) =>
  SETTERS.flatMap((method) => [...text.matchAll(new RegExp(`\\bgraph\\.${method}\\s*\\(`, "g"))].map(
    () => method,
  ));

describe("every write into cosmos.gl waits for its device", () => {
  it("finds the calls at all", () => {
    // A regex that quietly matches nothing reports the same green as a clean tree. Twelve is under
    // today's count of guarded calls with room for a few to be deleted.
    const guarded = sources.flatMap(({ text }) =>
      SETTERS.flatMap((method) => [...text.matchAll(new RegExp(`\\bready\\.${method}\\s*\\(`, "g"))]),
    );
    expect(guarded.length).toBeGreaterThanOrEqual(12);
  });

  it("has no module calling a setter on an instance it has not waited for", () => {
    const offenders = sources.flatMap(({ name, text }) =>
      unguarded(text).map((method) => `${name}: graph.${method}()`),
    );
    // Failing? Wrap the call: `return whenReady(graph, (ready) => { ready.…() })` from an effect, or
    // `await graph.ready` where the function is already async. If it genuinely cannot wait — a
    // pointer handler that must answer now — use `isReady(graph)` and say what the early answer is.
    expect([...new Set(offenders)].sort()).toEqual([]);
  });

  it("guards the two upstream marks as synchronous behind `isReady`", () => {
    for (const method of SYNCHRONOUS) {
      const callers = sources.filter(({ text }) => text.includes(`.${method}(`));
      expect(callers.length, `nobody calls ${method} — has it been renamed?`).toBeGreaterThan(0);
      for (const { name, text } of callers) {
        expect(text.includes("isReady("), `${name} calls ${method} without isReady`).toBe(true);
      }
    }
  });
});
