"use client";

import type { TableExpr } from "@kanzo-tech/mosaic";
import { useMemo } from "react";
import type React from "react";
import { ark } from "@ark-ui/react/factory";
import { EllipsisIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { Alert, AlertDescription, AlertTitle } from "../simples/alert.js";
import { Button } from "../simples/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../simples/card.js";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../simples/menu.js";
import { Skeleton } from "../simples/skeleton.js";
import { ChartCard } from "./chart-card.js";
import type { ChartConfig } from "./chart-config.js";
import { DashboardFilters } from "./dashboard-filters.js";
import { chartTableKey } from "./chart-spec.js";
import {
  autoDashboard,
  cardFor,
  plotRelation,
  type DashboardCardSpec,
  type DashboardSpec,
} from "./dashboard-spec.js";
import { DashboardStat } from "./dashboard-stat.js";
import { DetailTable } from "./detail-table.js";
import { useFieldStats, type FieldStat } from "./field-stats.js";

export interface DashboardProps extends Omit<React.ComponentProps<typeof ark.div>, "onChange" | "defaultValue"> {
  /** The relation every filter, tile, card and row reads. */
  table: TableExpr;
  /**
   * The saved dashboard. `undefined` draws the automatic one from the relation's field stats —
   * which is what a host persists nothing for until somebody edits it.
   */
  value?: DashboardSpec;
  /** Makes everything editable; called with the whole next spec, the automatic one included. */
  onChange?: (spec: DashboardSpec) => void;
  /** Columns that are the host's bookkeeping rather than data. */
  exclude?: readonly string[];
  /** Series vocabulary per field, for a field drawn as `color`. See `ChartCard`. */
  config?: Readonly<Record<string, ChartConfig>>;
  /** What a row is, in the plural. Default `"rows"`. */
  rowNoun?: string;
}

/**
 * A whole dashboard from a relation and, optionally, a saved spec: the filter row, the tiles, the
 * cards and the rows, every one of them on the provider's crossfilter. The host brings the
 * `MosaicProvider`, the relation and somewhere to keep the spec; the fields, the automatic layout
 * and the editors are this component's.
 */
export function Dashboard(props: DashboardProps) {
  const { table, value, onChange, exclude, config, rowNoun, className, slot, ...rest } = props;
  const { fields, columns, error } = useFieldStats(table, { exclude });
  // Everything below reads the relation the plots can: see `plotRelation`.
  const readable = useMemo(
    () =>
      fields && columns
        ? plotRelation(table, { fields, columns })
        : null,
    // `chartTableKey` stands in for the identity of `table`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fields, columns, chartTableKey(table)],
  );

  return (
    <ark.div className={cn("@container/dashboard flex flex-col gap-4", className)} {...rest} data-slot={slot ?? "dashboard"}>
      {error !== null ? (
        <Alert variant="destructive">
          <AlertTitle>The relation could not be summarized</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      ) : readable === null ? (
        <DashboardSkeleton />
      ) : (
        <Board
          config={config}
          fields={readable.fields}
          onChange={onChange}
          rowNoun={rowNoun}
          table={readable.table}
          value={value}
        />
      )}
    </ark.div>
  );
}

function Board({
  table,
  fields,
  value,
  onChange,
  config,
  rowNoun,
}: {
  table: TableExpr;
  fields: FieldStat[];
  value?: DashboardSpec;
  onChange?: (spec: DashboardSpec) => void;
  config?: Readonly<Record<string, ChartConfig>>;
  rowNoun?: string;
}) {
  const auto = useMemo(() => autoDashboard(fields), [fields]);
  const spec = value ?? auto;
  const edit = onChange && ((patch: Partial<DashboardSpec>) => onChange({ ...spec, ...patch }));

  const setCard = (index: number, card: DashboardCardSpec | null) =>
    edit?.({ cards: spec.cards.flatMap((c, i) => (i !== index ? [c] : card ? [card] : [])) });
  const moveCard = (index: number, offset: -1 | 1) => {
    const to = index + offset;
    if (to < 0 || to >= spec.cards.length) return;
    const cards = [...spec.cards];
    [cards[index], cards[to]] = [cards[to]!, cards[index]!];
    edit?.({ cards });
  };
  const addCard = () => {
    const used = new Set(spec.cards.map((c) => c.x));
    const card = [...fields].sort((a, b) => Number(used.has(a.name)) - Number(used.has(b.name)))
      .map((f) => cardFor(f))
      .find((c) => c !== null);
    if (card) edit?.({ cards: [...spec.cards, card] });
  };
  const addStat = () => {
    const measure = fields.find((f) => f.kind === "numeric" && f.role === "measure" && !spec.stats.some((s) => s.measure.field === f.name));
    edit?.({
      stats: [
        ...spec.stats,
        { id: globalThis.crypto.randomUUID(), measure: measure ? { op: "avg", field: measure.name } : { op: "count" } },
      ],
    });
  };

  return (
    <>
      <DashboardFilters
        fields={fields}
        filters={spec.filters}
        onChange={edit && ((filters) => edit({ filters }))}
        rowNoun={rowNoun}
        table={table}
      >
        {edit ? (
          <Menu>
            <MenuTrigger asChild>
              <Button aria-label="Edit dashboard" size="icon-sm" variant="ghost">
                <EllipsisIcon />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={addCard} value="card">
                Add chart
              </MenuItem>
              <MenuItem onSelect={addStat} value="stat">
                Add tile
              </MenuItem>
              {spec.detail ? null : (
                <MenuItem onSelect={() => edit({ detail: auto.detail ?? { columns: [] } })} value="rows">
                  Add rows table
                </MenuItem>
              )}
              <MenuSeparator />
              <MenuItem disabled={value === undefined} onSelect={() => edit(auto)} value="reset">
                Reset to automatic
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
      </DashboardFilters>

      {spec.stats.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4" data-slot="dashboard-stats">
          {spec.stats.map((stat, index) => (
            <DashboardStat
              fields={fields}
              key={stat.id}
              onChange={edit && ((next) => edit({ stats: spec.stats.map((s, i) => (i === index ? next : s)) }))}
              onRemove={edit && (() => edit({ stats: spec.stats.filter((_, i) => i !== index) }))}
              stat={stat}
              table={table}
            />
          ))}
        </div>
      ) : null}

      {spec.cards.length > 0 ? (
        <div className="grid gap-4 @3xl/dashboard:grid-cols-2 @6xl/dashboard:grid-cols-3" data-slot="dashboard-cards">
          {spec.cards.map((card, index) => (
            <ChartCard
              card={card}
              config={config}
              fields={fields}
              key={card.id}
              onChange={edit && ((next) => setCard(index, next))}
              onMove={edit && ((offset) => moveCard(index, offset))}
              onRemove={edit && (() => setCard(index, null))}
              table={table}
            />
          ))}
        </div>
      ) : null}

      {spec.detail ? (
        <Card className="[--space:--spacing(4)] gap-3">
          <CardHeader>
            <CardTitle className="font-medium text-sm">Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailTable
              columns={spec.detail.columns}
              fields={fields}
              onChange={edit && ((columns) => edit({ detail: columns.length ? { columns } : null }))}
              table={table}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-28 w-full rounded-lg" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton className="h-24 w-full rounded-lg" key={i} />
        ))}
      </div>
      <div className="grid gap-4 @3xl/dashboard:grid-cols-2 @6xl/dashboard:grid-cols-3">
        <Skeleton className="h-72 w-full rounded-lg @3xl/dashboard:col-span-2" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </>
  );
}
