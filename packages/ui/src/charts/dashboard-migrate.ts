import { relationKey } from "@kanzo-tech/mosaic";
import type { DashboardMeasure, DashboardSpec, Tile, TileSpan } from "./dashboard-spec.js";

/**
 * Every dashboard a host keeps, keyed by the relation it is drawn over (`relationKey`): a type's is
 * keyed by the type's name, a joined relation's by its path. One document, written whole.
 */
export interface Dashboards {
  version: 2;
  byRelation: Record<string, DashboardSpec>;
}

/** The first spec: tiles, cards and the rows table as three lists, over a type's own column names. */
interface DashboardSpecV1 {
  version: 1;
  filters: { field: string }[];
  stats: { id: string; label?: string; measure: DashboardMeasure; trend?: string; goodWhenUp?: boolean }[];
  cards: {
    id: string;
    type: Extract<Tile, { kind: "chart" }>["type"];
    x: string;
    y: DashboardMeasure;
    color?: string;
    facet?: string;
    span?: TileSpan;
    title?: string;
  }[];
  detail: { columns: string[] } | null;
}

/** The first document: one spec per vertex type. */
interface DashboardsV1 {
  version: 1;
  byType: Record<string, DashboardSpecV1>;
}

/**
 * A first spec as the second, over the relation of `type` alone: the figures, the charts and the
 * rows table become tiles in that order, and every field is renamed as that relation names it —
 * `country` becomes `Person.country`.
 */
export function migrateDashboard(spec: DashboardSpecV1, type: string): DashboardSpec {
  const name = (field: string) => `${type}.${field}`;
  const optional = (field: string | undefined) => (field === undefined ? {} : { field: name(field) });
  const measure = (m: DashboardMeasure): DashboardMeasure => ({ ...m, ...optional(m.field) });
  const tiles: Tile[] = [
    ...spec.stats.map(({ label, trend, ...stat }): Tile => ({
      ...stat,
      kind: "stat",
      span: 1,
      measure: measure(stat.measure),
      ...(label === undefined ? {} : { title: label }),
      ...(trend === undefined ? {} : { trend: name(trend) }),
    })),
    ...spec.cards.map(({ color, facet, span, ...card }): Tile => ({
      ...card,
      kind: "chart",
      span: span ?? 1,
      x: name(card.x),
      y: measure(card.y),
      ...(color === undefined ? {} : { color: name(color) }),
      ...(facet === undefined ? {} : { facet: name(facet) }),
    })),
    ...(spec.detail ? [{ id: "rows", kind: "table" as const, span: 3 as const, columns: spec.detail.columns.map(name) }] : []),
  ];
  return { version: 2, filters: spec.filters.map((f) => ({ field: name(f.field) })), tiles };
}

/**
 * Whatever a host stored, as the current document: nothing is no dashboards, a current document is
 * itself, and a first one — a spec per vertex type — is each type's spec keyed by the relation of
 * that type alone. Anything else throws rather than being read as nothing, so a newer document is
 * never overwritten by an older reader's first edit.
 */
export function migrateDashboards(saved: unknown): Dashboards {
  if (saved == null) return { version: 2, byRelation: {} };
  const version = (saved as { version?: unknown }).version;
  if (version === 2) return saved as Dashboards;
  if (version !== 1) throw new Error(`no migration from dashboards version ${String(version)}`);
  const byRelation: Record<string, DashboardSpec> = {};
  for (const [type, spec] of Object.entries((saved as DashboardsV1).byType)) {
    byRelation[relationKey({ edges: [] }, { root: type, path: [] })] = migrateDashboard(spec, type);
  }
  return { version: 2, byRelation };
}
