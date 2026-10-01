"use client";

import {
  Badge,
  cn,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ScrollArea,
  ShellAside,
  Status,
  ToggleGroup,
  ToggleGroupItem,
} from "@kanzo-tech/ui";
import { Fragment, type ComponentType, type ReactNode } from "react";

export interface RailPanel {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

/** The activity rail: a `ShellAside` region, not a bare `ToggleGroup` (a control carries a radius). */
export function PanelRail({
  label,
  onValueChange,
  panels,
  value,
}: {
  label: string;
  onValueChange: (value: string[]) => void;
  panels: RailPanel[];
  value: string[];
}) {
  return (
    <ShellAside aria-label={label} className="shrink-0 bg-card" side="start">
      <ToggleGroup
        className="rounded-none px-1.5 py-2"
        multiple
        onValueChange={(d) => onValueChange(d.value)}
        orientation="vertical"
        size="sm"
        spacing={2}
        value={value}
      >
        {panels.map((panel) => (
          <ToggleGroupItem
            aria-label={panel.label}
            key={panel.value}
            title={panel.label}
            value={panel.value}
          >
            <panel.icon aria-hidden />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </ShellAside>
  );
}

export function PaneHeader({
  actions,
  detail,
  icon: Icon,
  title,
  tone,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  title: string;
  tone?: "destructive" | "info" | "success" | "warning";
}) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="shrink-0 font-medium text-xs">{title}</span>
      {actions}
      <span className="ms-auto flex min-w-0 items-center gap-1.5">
        {tone ? <Status className="size-1.5 shrink-0" variant={tone} /> : null}
        {detail ? (
          <span className="truncate text-muted-foreground text-xs" title={detail}>
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export interface Finding {
  where: string;
  message: string;
}

/**
 * A tally that can be interrogated: hovering lists every finding, pressing marks them where they
 * are. The reveal lives on the badge because a hover card closes when the pointer leaves its
 * trigger, so a control inside it could not be reliably clicked.
 */
export function FindingsBadge({
  active,
  findings,
  label,
  onToggle,
  summary,
  tone,
}: {
  active: boolean;
  findings: Finding[];
  label: string;
  onToggle: () => void;
  summary: string;
  tone: "destructive" | "success" | "warning";
}) {
  return (
    <HoverCard openDelay={80}>
      <HoverCardTrigger asChild>
        <button
          aria-label={active ? `Stop marking ${label}` : `Mark every ${label} where it is`}
          aria-pressed={active}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          disabled={findings.length === 0}
          onClick={onToggle}
          type="button"
        >
          <Badge className="tabular-nums" pill size="xs" variant={active ? tone : "outline"}>
            <Status className={cn("size-1.5", !active && "opacity-64")} variant={tone} />
            {/* A fixed cell, so 9 → 10 does not shuffle the badges beside it while a run fills. */}
            <span className="inline-block min-w-[2ch] text-end">{findings.length}</span> {label}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="font-medium text-sm">
            {findings.length} {label}
          </p>
          <p className="text-muted-foreground text-xs">{summary}</p>
        </div>
        <ScrollArea className="max-h-64">
          <ul className="divide-y">
            {findings.map((finding, i) => (
              <li className="flex items-start justify-between gap-3 px-3 py-1.5" key={i}>
                <span className="shrink-0 font-medium text-xs">{finding.where}</span>
                <span className="text-end text-muted-foreground text-xs">{finding.message}</span>
              </li>
            ))}
          </ul>
        </ScrollArea>
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          {active
            ? "Press the badge to stop marking them."
            : "Press the badge to mark them where they are."}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

export interface WorkspaceColumn {
  id: string;
  /** Percent of the row this column may not go below. */
  minSize: number;
  node: ReactNode;
}

/**
 * Panels beside one `<main>`, every seam draggable. The `key` is the open set because Ark's
 * splitter builds its panel model once; a single column needs no splitter at all.
 */
export function WorkspaceColumns({
  columns,
  defaultSize,
}: {
  columns: WorkspaceColumn[];
  defaultSize: number[];
}) {
  if (columns.length === 1) return columns[0]?.node ?? null;

  return (
    <Resizable
      defaultSize={defaultSize}
      key={columns.map((column) => column.id).join("-")}
      panels={columns.map(({ id, minSize }) => ({ id, minSize }))}
    >
      {columns.map((column, i) => (
        <Fragment key={column.id}>
          {i > 0 ? (
            <ResizableResizeTrigger id={`${columns[i - 1]?.id}:${column.id}`} withHandle />
          ) : null}
          <ResizablePanel className="flex min-w-0 flex-col overflow-hidden" id={column.id}>
            {column.node}
          </ResizablePanel>
        </Fragment>
      ))}
    </Resizable>
  );
}
