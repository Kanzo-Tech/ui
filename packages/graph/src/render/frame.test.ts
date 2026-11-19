import { describe, expect, it } from "vitest";
import type { Geometry } from "../core/load";
import type { GraphOptions, GraphSnapshot } from "../core/state";
import { planChange, planFrame, type Dirty, type FrameInputs, type Seen } from "./frame";

/**
 * The order cosmos.gl depends on, as the operations the renderer is told to carry out. What this
 * cannot prove is that `renderer.ts` carries them out against cosmos.gl as named: `renderer.test.ts`
 * holds that, against a cosmos.gl that records what it is told.
 */

const ALL: Dirty = { positions: true, paint: true, state: true };
const NONE: Dirty = { positions: false, paint: false, state: false };
const READY: FrameInputs = { geometry: true, encoding: true, newLinks: false };

describe("one frame", () => {
  it.each<[string, Dirty, FrameInputs, string[], Dirty]>([
    ["a new graph uploads, renders once, and only then lays out", ALL, { ...READY, newLinks: true }, ["positions", "links", "paint", "state", "render", "layout", "drawn"], NONE],
    ["positions over the same links upload no links", { ...NONE, positions: true }, READY, ["positions", "render", "layout", "drawn"], NONE],
    ["new links repaint and restate what was clean", { ...NONE, positions: true }, { ...READY, newLinks: true }, ["positions", "links", "paint", "state", "render", "layout", "drawn"], NONE],
    ["a look repaints and renders, and uploads no geometry", { ...NONE, paint: true }, READY, ["paint", "render", "drawn"], NONE],
    ["a selection is config: no upload, no render", { ...NONE, state: true }, READY, ["state", "drawn"], NONE],
    ["positions wait for the first colours", ALL, { ...READY, encoding: false }, ["state"], { positions: true, paint: true, state: false }],
    ["nothing is drawn before a geometry", ALL, { geometry: false, encoding: false, newLinks: true }, [], ALL],
    ["a clean frame only reports what it drew", NONE, READY, ["drawn"], NONE],
  ])("%s", (_, dirty, inputs, ops, left) => {
    expect(planFrame(dirty, inputs)).toEqual({ ops, dirty: left });
  });

  it("renders at most once, never before an upload, and starts the layout only after it", () => {
    const flags = [false, true];
    for (const positions of flags)
      for (const paint of flags)
        for (const state of flags)
          for (const geometry of flags)
            for (const encoding of flags)
              for (const newLinks of flags) {
                const { ops } = planFrame({ positions, paint, state }, { geometry, encoding, newLinks });
                const render = ops.indexOf("render");
                expect(ops.filter((op) => op === "render").length).toBeLessThanOrEqual(1);
                if (render >= 0) expect(ops.slice(0, render).some((op) => op === "positions" || op === "paint")).toBe(true);
                if (ops.includes("layout")) expect(ops.indexOf("layout")).toBeGreaterThan(render);
                if (render >= 0) expect(render).toBeGreaterThan(ops.indexOf("state"));
              }
  });
});

const geometry = (over: Partial<Geometry> = {}): Geometry => ({
  structure: { types: [], edges: [] },
  size: 4,
  positions: new Float32Array(8),
  bound: false,
  links: Float32Array.of(0, 1),
  extent: null,
  space: 4096,
  ...over,
});
/** A structure whose one type carries `lon` and `lat`, so binding both places the points before any geometry loads. */
const structure = {
  types: [{ name: "Place", table: "Place", key: "id", columns: ["id", "lon", "lat"].map((name) => ({ name, type: "DOUBLE" })) }],
  edges: [],
} as unknown as GraphSnapshot["structure"];

const options: GraphOptions = { from: "c", engine: null, onFailure: () => {} };
const start = geometry();
function seen(snapshot: Partial<GraphSnapshot> = {}, over: Partial<GraphOptions> = {}): Seen {
  const base = { geometry: start, encoding: null, selection: null, focus: null, kept: null, structure, motion: "running" } as unknown as GraphSnapshot;
  return { snapshot: { ...base, ...snapshot }, options: { ...options, ...over } };
}
const was = seen();

describe("a change", () => {
  it.each<[string, Seen, boolean, Partial<Dirty>, string[]]>([
    ["a new geometry dirties its positions, and the frame decides its layout", seen({ geometry: geometry() }), true, { positions: true }, []],
    ["a new encoding repaints", seen({ encoding: {} as GraphSnapshot["encoding"] }), true, { paint: true }, []],
    ["a look is resolved again, and repaints", seen({}, { look: { vignette: true } }), true, { paint: true }, ["look"]],
    ["a channel repaints", seen({}, { fill: "team" }), true, { paint: true }, []],
    ["a selection, a focus or a filter restates", seen({ focus: 2 }), true, { state: true }, []],
    ["forces apply at once", seen({}, { sim: { gravity: 0.5 } }), true, {}, ["forces"]],
    ["binding the second axis pauses a moving layout before its geometry lands", seen({}, { x: "lon", y: "lat" }), true, {}, ["pause"]],
    ["binding the second axis pauses nothing that is not moving", seen({}, { x: "lon", y: "lat" }), false, {}, []],
    ["simulate off pauses the layout over the same geometry", seen({}, { simulate: false }), false, {}, ["pause"]],
    ["simulate off over a new geometry leaves it to the frame", seen({ geometry: geometry() }, { simulate: false }), false, { positions: true }, []],
    ["a hover or a motion asks for nothing", seen({ hovered: 1, motion: "settled" }), true, {}, []],
  ])("%s", (_, next, moving, dirty, ops) => {
    expect(planChange(was, next, moving)).toEqual({ dirty: { ...NONE, ...dirty }, ops });
  });

  it("runs the layout when simulate turns on over the same geometry, and never over the data's positions", () => {
    const still = seen({}, { simulate: false });
    expect(planChange(still, seen(), false).ops).toEqual(["run"]);
    const bound = geometry({ bound: true });
    expect(planChange(seen({ geometry: bound }, { simulate: false }), seen({ geometry: bound }), false).ops).toEqual([]);
  });

  it("orders what cannot wait: the look, the forces, then the layout", () => {
    const next = seen({}, { look: { vignette: true }, sim: { gravity: 0.5 } });
    expect(planChange(seen({}, { simulate: false }), next, false).ops).toEqual(["look", "forces", "run"]);
  });
});
