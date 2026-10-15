"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Skeleton } from "@kanzo-tech/ui";
import { loadObjects, type Engine, type JoinGraph } from "@kanzo-tech/mosaic";
import { useMosaic } from "@kanzo-tech/ui/analytics";
import { ARCHIVE } from "@/example/archive";
import { GRADES } from "@/example/world";
import { rng } from "@/lib/rng";
import { MosaicDemo } from "../charts/mosaic-demo";

// The archive's 536 closed contracts as a relation, for the two dashboard examples `sightings`
// cannot serve: it has a real time (`closed`), and an `id` that is the contracts' key — which the
// page says, in `CONTRACTS_JOINS`, because nothing reads a key off a column's name or its count.
//
// `contracts_layout` is the same rows shaped like a fossil corpus's vertex table — a `dense_id` and
// a layout's `x` and `y` beside the data — which is the relation the channel-named-columns pitfall
// is about. Both are loaded into the page's one engine on first use, not at boot, so the charts
// pages never pay for them.

export const CONTRACTS = "contracts";
export const CONTRACTS_LAYOUT = "contracts_layout";

/**
 * What the page says of `contracts`: one type, keyed by `id`, which is a key — never null, never
 * repeated. The dashboard reads it as an identifier, searched and never grouped, and every other
 * column from its type alone; a fossil corpus says the same of its own tables, from its catalog.
 */
export const CONTRACTS_JOINS: JoinGraph = {
  types: [{ name: CONTRACTS, table: CONTRACTS, key: "id", candidateKeys: ["id"], columns: [{ name: "id", type: "VARCHAR" }] }],
  edges: [],
};

const DAY = 86_400_000;
// The archive counts days back from the world's own `TODAY`, in 1312. Dates that old render with the
// local mean time a browser applies before 1900 (a clock reading 23:45:16), so the days are counted
// back from a date in our calendar instead; the spacing is the archive's.
const CLOSED_FROM = Date.UTC(2026, 8, 14);
const GRADE_LABEL = new Map(GRADES.map((g) => [g.value, g.label]));

function rows() {
  return ARCHIVE.map((c) => ({
    id: c.id,
    closed: new Date(CLOSED_FROM + c.closedDayOffset * DAY),
    hall: c.hall,
    region: c.region,
    beast: c.beast ?? "none",
    grade: GRADE_LABEL.get(c.grade) ?? String(c.grade),
    outcome: c.outcome,
    reward: c.reward,
    party: c.party.length,
    reports: c.reports,
  }));
}

/** One cluster per region, the way a force layout leaves a corpus. */
function laidOut() {
  const random = rng(0x1a7);
  const centre = new Map<string, [number, number]>();
  return rows().map((row, dense_id) => {
    if (!centre.has(row.region)) {
      const angle = (centre.size / 6) * 2 * Math.PI;
      centre.set(row.region, [Math.cos(angle) * 400, Math.sin(angle) * 400]);
    }
    const [cx, cy] = centre.get(row.region)!;
    return { dense_id, x: random.gauss(cx, 90), y: random.gauss(cy, 90), ...row };
  });
}

const loading = new Map<string, Promise<void>>();

function ensure(engine: Engine, table: string): Promise<void> {
  let pending = loading.get(table);
  if (!pending) {
    const load = String(loadObjects(table, table === CONTRACTS ? rows() : laidOut()));
    pending = engine.query(load, { signal: new AbortController().signal }).then(() => undefined);
    loading.set(table, pending);
  }
  return pending;
}

function Loaded({ table, children }: { table: string; children: ReactNode }) {
  const { engine } = useMosaic();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    ensure(engine, table).then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [engine, table]);

  return ready ? children : <Skeleton className="h-96 w-full" />;
}

/** `MosaicDemo`, with one of the two contracts relations loaded before the children mount. */
export function ContractsDemo({ table, children }: { table: string; children: ReactNode }) {
  return (
    <MosaicDemo joins={table === CONTRACTS ? CONTRACTS_JOINS : undefined}>
      <Loaded table={table}>{children}</Loaded>
    </MosaicDemo>
  );
}
