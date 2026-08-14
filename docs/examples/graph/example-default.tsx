"use client";

import { GraphCanvas, memorySource, SPACE, vertexId } from "@kanzo-tech/graph";
import { Show } from "@kanzo-tech/ui";
import { useMemo, useState } from "react";
import { BEASTS, HALLS, REGIONS } from "@/example/world";

/**
 * The smallest graph this package can draw: arrays in hand, no database, no precomputed layout.
 *
 * `memorySource` is the source for exactly this host, and the simulation stays off — its default —
 * because the positions below are the authority. That is the same reason it is off for a bounded
 * source: the coordinates come back from the source, and a force would move the picture out from
 * under the index the next query is expressed in.
 *
 * A source and one required callback. `onFailure` is the one thing this cannot omit, and that is on
 * purpose: without WebGL the canvas is an empty box, and the host is what decides what stands in
 * its place. `children` are chrome drawn over the surface — here, only the message.
 */
export default function Example() {
  const source = useMemo(() => memorySource(GUILD), []);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <GraphCanvas
      className="rounded-lg border border-border bg-card"
      onFailure={setFailure}
      source={source}
    >
      <Show when={failure !== null}>
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-muted-foreground text-sm">
          {failure}
        </p>
      </Show>
    </GraphCanvas>
  );
}

/**
 * Halls, the regions they are seated in, and the beasts recorded there — as the three parallel
 * arrays a renderer wants.
 *
 * A category is an **ordinal**, never a name, so the domain is ranked once here and the codes follow
 * that order. Positions are a ring per category rather than a layout: the simulation is what turns
 * them into one, and starting every point at the origin gives the forces nothing to push apart.
 */
const KINDS = ["hall", "region", "beast"] as const;

const NODES = [
  ...HALLS.map((h) => ({ label: h.short, kind: 0, seat: h.seat })),
  ...REGIONS.map((r) => ({ label: r, kind: 1, seat: r })),
  ...BEASTS.map((b, i) => ({ label: b.label, kind: 2, seat: REGIONS[i % REGIONS.length] as string })),
];

const REGION_AT = new Map(REGIONS.map((r, i) => [r as string, HALLS.length + i]));

const ring = (angle: number, r: number) => [
  SPACE / 2 + Math.cos(angle) * SPACE * r,
  SPACE / 2 + Math.sin(angle) * SPACE * r,
];

const GUILD = {
  vertices: BigUint64Array.from(NODES.map((_, i) => vertexId(0, i))),
  // Regions on an inner ring, and everything else beside the region it belongs to — a hub picture,
  // computed once. Two things this had to learn: positions live in `SPACE`, cosmos.gl's simulation
  // box, and a ring at the origin with radius 40 draws an empty canvas and says nothing; and with
  // `simulate` on, nineteen barely-connected nodes fly apart before `fitViewOnInit` frames them at
  // 900 ms. Positions are authority here, which is also why the simulation is off by default.
  positions: Float32Array.from(
    NODES.flatMap((n, i) => {
      const home = REGION_AT.get(n.seat) ?? i;
      const spoke = ((home - HALLS.length) / REGIONS.length) * Math.PI * 2;
      if (n.kind === 1) return ring(spoke, 0.16);
      // Fan the satellites either side of their region's spoke so two never land on one another.
      return ring(spoke + (((i % 3) - 1) * Math.PI) / 9, 0.34);
    }),
  ),
  // Every node that is not itself a region joins the region it belongs to.
  links: Float32Array.from(
    NODES.flatMap((n, i) => {
      const at = REGION_AT.get(n.seat);
      return n.kind === 1 || at === undefined || at === i ? [] : [i, at];
    }),
  ),
  categories: Uint16Array.from(NODES.map((n) => n.kind)),
};

export { KINDS };
