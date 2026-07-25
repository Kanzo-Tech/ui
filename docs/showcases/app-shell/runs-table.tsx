"use client";

import type { ComponentProps } from "react";
import {
  ActionBar,
  ActionBarClose,
  ActionBarContent,
  ActionBarSeparator,
  ActionBarValue,
  Badge,
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  toast,
} from "@kanzo-tech/ui";
import {
  type ColumnDef,
  DataTableContent,
  DataTableFacetFilter,
  DataTablePagination,
  DataTableRoot,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewOptions,
  facetFilterFn,
  selectColumn,
  sortableHeader,
  useDataTable,
} from "@kanzo-tech/ui/table";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  DownloadIcon,
  EllipsisIcon,
  RotateCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { type Run, type RunStatus, RUNS } from "./data";

const STATUS_VARIANT = {
  succeeded: "success",
  running: "info",
  failed: "destructive",
} as const;

const STATUS_ICON = {
  succeeded: CircleCheckIcon,
  running: CircleDashedIcon,
  failed: CircleXIcon,
};

const numberFmt = new Intl.NumberFormat("en-US");

function duration(seconds: number) {
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** `sortableHeader` has no alignment of its own, so a numeric column wraps it to sit over its
 *  end-aligned figures. `/table` does not re-export `HeaderContext`, hence the ComponentProps. */
function numericHeader(label: string) {
  const Header = sortableHeader<Run, unknown>(label);
  return (context: ComponentProps<typeof Header>) => (
    <div className="flex justify-end">
      <Header {...context} />
    </div>
  );
}

const COLUMNS: ColumnDef<Run>[] = [
  selectColumn<Run>({ rowLabel: (row) => `Select ${row.original.pipeline}` }),
  {
    accessorKey: "pipeline",
    header: sortableHeader("Pipeline"),
    meta: { label: "Pipeline" },
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.pipeline}</div>
        <div className="truncate text-muted-foreground text-xs">{row.original.source}</div>
      </div>
    ),
  },
  {
    accessorKey: "environment",
    header: "Environment",
    filterFn: facetFilterFn,
    cell: ({ getValue }) => (
      <Badge size="sm" variant="outline">
        {getValue<string>()}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: facetFilterFn,
    cell: ({ getValue }) => {
      const status = getValue<RunStatus>();
      const Icon = STATUS_ICON[status];
      return (
        <Badge size="sm" variant={STATUS_VARIANT[status]}>
          <Icon />
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "rows",
    header: numericHeader("Rows"),
    meta: { label: "Rows" },
    cell: ({ getValue }) => (
      <span className="block text-end text-sm tabular-nums">
        {numberFmt.format(getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "duration",
    header: numericHeader("Duration"),
    meta: { label: "Duration" },
    cell: ({ getValue }) => (
      <span className="block text-end text-muted-foreground text-sm tabular-nums">
        {duration(getValue<number>())}
      </span>
    ),
  },
  {
    accessorKey: "started",
    header: "Started",
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-muted-foreground text-sm">{getValue<string>()}</span>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => (
      <div className="text-end">
        <Menu>
          <MenuTrigger asChild>
            <Button
              aria-label={`Actions for ${row.original.pipeline}`}
              onClick={(event) => event.stopPropagation()}
              size="icon-sm"
              variant="ghost"
            >
              <EllipsisIcon />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => toast.create({ title: `Re-running ${row.original.pipeline}`, type: "info" })}
              value="rerun"
            >
              <RotateCwIcon />
              Re-run
            </MenuItem>
            <MenuItem onSelect={() => toast.create({ title: "Logs downloaded", type: "success" })} value="logs">
              <DownloadIcon />
              Download logs
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onSelect={() => toast.create({ title: `Delete ${row.original.pipeline}?`, type: "warning" })}
              value="delete"
            >
              <Trash2Icon />
              Delete
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    ),
  },
];

const STATUS_OPTIONS = (["succeeded", "running", "failed"] as const).map((value) => ({
  value,
  icon: STATUS_ICON[value],
}));

/**
 * The runs table, built from the `/table` parts rather than the `DataTable` preset: row
 * selection, facet filters and column visibility only exist down here, and the selection then
 * drives an `ActionBar`.
 */
export function RunsTable() {
  const table = useDataTable({ columns: COLUMNS, data: RUNS, pageSize: 6 });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <DataTableRoot table={table}>
      <DataTableToolbar id="tour-runs-toolbar">
        <DataTableSearch column="pipeline" placeholder="Search runs…" />
        <DataTableFacetFilter column="status" label="Status" options={STATUS_OPTIONS} />
        <DataTableFacetFilter column="environment" label="Environment" />
        <DataTableViewOptions className="ms-auto" />
      </DataTableToolbar>

      <DataTableContent<Run>
        empty="No runs match these filters."
        onRowClick={(run) => toast.create({ title: run.pipeline, description: run.source, type: "info" })}
      />

      <DataTablePagination pageSizes={[6, 12, 24]} />

      <ActionBar
        onOpenChange={(open) => {
          if (!open) table.resetRowSelection();
        }}
        open={selected.length > 0}
        // Lifted clear of the shell's status footer.
        positioning={{ gutter: "52px" }}
      >
        <ActionBarContent>
          <ActionBarValue count={selected.length} label={`${selected.length} selected`} />
          <ActionBarSeparator />
          <Button
            onClick={() => toast.create({ title: `Re-running ${selected.length} runs`, type: "info" })}
            size="sm"
            variant="ghost"
          >
            <RotateCwIcon />
            Re-run
          </Button>
          <Button
            onClick={() => toast.create({ title: "Export queued", type: "success" })}
            size="sm"
            variant="ghost"
          >
            <DownloadIcon />
            Export
          </Button>
          <ActionBarSeparator />
          <ActionBarClose>
            <XIcon className="size-4" />
          </ActionBarClose>
        </ActionBarContent>
      </ActionBar>
    </DataTableRoot>
  );
}
