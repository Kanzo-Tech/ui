"use client";

import {
  Button,
  Resizable,
  ResizablePanel,
  ResizableResizeTrigger,
  ShellAside,
  Status,
  ToggleGroup,
  ToggleGroupItem,
} from "@kanzo-tech/ui";
import { XIcon } from "lucide-react";
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
  onClose,
  title,
  tone,
}: {
  actions?: ReactNode;
  detail?: string;
  icon: ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
  onClose: () => void;
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
        <Button
          aria-label={`Close ${title}`}
          className="size-6 shrink-0 text-muted-foreground"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </span>
    </div>
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
