import { describe, expect, it } from "vitest";
import { fakeCorpus, type FakeCorpus } from "../../test/corpus";
import type { TileContent } from "./tile";
import type { Viewport } from "./tile-matrix";
import { Tileset2D, type TilesetOptions } from "./tileset";

/**
 * The tileset against a corpus on a line — sixteen vertices, four payload tiles of four at `z = 1`,
 * one tile of four cells at `z = 0` — with every read held until the test lets it go. What it
 * cannot prove is the order DuckDB-WASM answers in; the one-slot claim is the scheduler's, measured
 * in the browser (`/docs/design/graph`).
 */

const tile = (t: number): Viewport => ({ xMin: t * 4 + 0.5, xMax: t * 4 + 2.5, yMin: -1, yMax: 1 });
const all: Viewport = { xMin: -1, xMax: 17, yMin: -1, yMax: 1 };

function tilesetOver(fake: FakeCorpus, options: Partial<TilesetOptions> = {}) {
  const scan = fake.corpus.scan({ type: "Node" });
  const tileset = new Tileset2D({
    debounceTime: 0,
    load: async (address, signal): Promise<TileContent> => ({
      rows: await scan.read(address, { signal }),
      edges: [],
      declined: [],
      byteLength: 1,
    }),
    onTileLoad: () => tileset.refresh(),
    ...options,
  });
  tileset.setMatrix(fake.corpus.tileMatrix("Node"));
  tileset.setPlan(scan.plan());
  return tileset;
}

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (fake: FakeCorpus) => fake.reads.map((r) => `${r.address.z}/${r.address.tile}`);

describe("Tileset2D over a corpus", () => {
  it("chooses the finest zoom whose tiles in view fit the limit", () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update(all, 20);
    expect(tileset.z).toBe(1);
    tileset.update(all, 8);
    expect(tileset.z).toBe(0);
    tileset.update(tile(2), 8);
    expect(tileset.z).toBe(1);
    expect(tileset.selectedTiles.map((t) => t.address.tile)).toEqual([2]);
  });

  it("reads a selected tile once, and never asks a loaded tile again", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update(tile(0), 20);
    await fake.settle();
    tileset.update(tile(1), 20);
    await fake.settle();
    tileset.update(tile(0), 20);
    tileset.update({ ...tile(0), xMax: 6 }, 20);
    await fake.settle();
    expect(read(fake)).toEqual(["1/0", "1/1"]);
  });

  it("aborts an in-flight tile that stops being selected or visible", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update(tile(0), 20);
    await tick();
    expect(read(fake)).toEqual(["1/0"]);
    tileset.update(tile(3), 20);
    expect(fake.reads[0]?.signal?.aborted).toBe(true);
    await fake.settle();
    expect(tileset.tiles.find((t) => t.address.tile === 3)?.content).not.toBeNull();
  });

  it("never issues a queued tile nobody wants any more", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update({ xMin: 0.5, xMax: 6.5, yMin: -1, yMax: 1 }, 20);
    await tick();
    expect(read(fake)).toHaveLength(1);
    tileset.update(tile(3), 20);
    await fake.settle();
    expect(read(fake)).not.toContain("1/1");
    expect(read(fake).at(-1)).toBe("1/3");
  });

  it("never evicts a visible tile, and evicts the rest in insertion order", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake, { maxCacheSize: 1 });
    tileset.update({ xMin: 0.5, xMax: 6.5, yMin: -1, yMax: 1 }, 20);
    await fake.settle();
    expect(tileset.tiles.filter((t) => t.isVisible)).toHaveLength(2);
    expect(tileset.tiles).toHaveLength(2);
    tileset.update(tile(3), 20);
    await fake.settle();
    expect(tileset.tiles.map((t) => t.address.tile)).toEqual([3]);
  });

  it("draws a parent only while a selected child is loading", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update(all, 8);
    await fake.settle();
    tileset.update(tile(1), 20);
    const parent = tileset.tiles.find((t) => t.z === 0);
    expect(parent?.isVisible).toBe(true);
    await fake.settle();
    expect(parent?.isVisible).toBe(false);
    expect(tileset.selectedTiles[0]?.isVisible).toBe(true);
  });

  it("keeps the old content when the question changes, until the new answer arrives", async () => {
    const fake = fakeCorpus();
    const tileset = tilesetOver(fake);
    tileset.update(tile(0), 20);
    await fake.settle();
    const [first] = tileset.selectedTiles;
    const before = first?.content;
    tileset.reloadAll();
    tileset.update(tile(0), 20);
    expect(first?.isVisible).toBe(true);
    expect(first?.content).toBe(before);
    await fake.settle();
    expect(first?.content).not.toBe(before);
    expect(read(fake)).toEqual(["1/0", "1/0"]);
  });
});
