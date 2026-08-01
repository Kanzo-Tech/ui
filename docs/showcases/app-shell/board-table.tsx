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
  CircleDotIcon,
  CircleXIcon,
  DownloadIcon,
  EllipsisIcon,
  FootprintsIcon,
  RotateCwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { board, daysOverdue, hallOf, isOverdue, postedOn, type Quest } from "@/example/quests";
import { questStatus, QUEST_STATUSES, type QuestStatusId } from "@/example/world";

// The tone belongs to the world — `questStatus("failed").tone` is what every other status badge in
// these docs reads — so only the icons are chosen here.
const STATUS_ICON: Record<QuestStatusId, typeof CircleCheckIcon> = {
  open: CircleDashedIcon,
  claimed: CircleDotIcon,
  afield: FootprintsIcon,
  settled: CircleCheckIcon,
  failed: CircleXIcon,
};

const numberFmt = new Intl.NumberFormat("en-US");

/** The due date as a distance, so the column can sort on the raw offset and still read as prose. */
function due(contract: Quest) {
  if (isOverdue(contract)) return `${daysOverdue(contract)} d late`;
  if (contract.dueDayOffset === 0) return "today";
  return contract.dueDayOffset > 0 ? `in ${contract.dueDayOffset} d` : `${-contract.dueDayOffset} d ago`;
}

/** `sortableHeader` has no alignment of its own, so a numeric column wraps it to sit over its
 *  end-aligned figures. `/table` does not re-export `HeaderContext`, hence the ComponentProps. */
function numericHeader(label: string) {
  const Header = sortableHeader<Quest, unknown>(label);
  return (context: ComponentProps<typeof Header>) => (
    <div className="flex justify-end">
      <Header {...context} />
    </div>
  );
}

const COLUMNS: ColumnDef<Quest>[] = [
  selectColumn<Quest>({ rowLabel: (row) => `Select ${row.original.title}` }),
  {
    accessorKey: "title",
    header: sortableHeader("Contract"),
    meta: { label: "Contract" },
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.title}</div>
        <div className="truncate text-muted-foreground text-xs">
          {row.original.id} · {hallOf(row.original).short}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "region",
    header: "Region",
    filterFn: facetFilterFn,
    cell: ({ getValue }) => (
      <Badge size="sm" variant="outline">
        {getValue<string>()}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "State",
    filterFn: facetFilterFn,
    cell: ({ getValue }) => {
      const state = questStatus(getValue<QuestStatusId>());
      const Icon = STATUS_ICON[state.id];
      return (
        <Badge size="sm" variant={state.tone}>
          <Icon />
          {state.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: "reward",
    header: numericHeader("Reward"),
    meta: { label: "Reward" },
    cell: ({ getValue }) => (
      <span className="block text-end text-sm tabular-nums">
        {numberFmt.format(getValue<number>())} g
      </span>
    ),
  },
  {
    accessorKey: "dueDayOffset",
    header: numericHeader("Due"),
    meta: { label: "Due" },
    cell: ({ row }) => (
      <span className="block text-end text-muted-foreground text-sm tabular-nums">
        {due(row.original)}
      </span>
    ),
  },
  {
    accessorFn: postedOn,
    id: "posted",
    header: "Posted",
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
              aria-label={`Actions for ${row.original.title}`}
              onClick={(event) => event.stopPropagation()}
              size="icon-sm"
              variant="ghost"
            >
              <EllipsisIcon />
            </Button>
          </MenuTrigger>
          <MenuContent>
            <MenuItem
              onSelect={() => toast.create({ title: `Re-posting ${row.original.id}`, type: "info" })}
              value="repost"
            >
              <RotateCwIcon />
              Re-post
            </MenuItem>
            <MenuItem onSelect={() => toast.create({ title: "Writ copied", type: "success" })} value="writ">
              <DownloadIcon />
              Copy the writ
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              onSelect={() => toast.create({ title: `Withdraw ${row.original.id}?`, type: "warning" })}
              value="withdraw"
            >
              <Trash2Icon />
              Withdraw
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    ),
  },
];

const STATUS_OPTIONS = QUEST_STATUSES.map((state) => ({
  value: state.id,
  label: state.label,
  icon: STATUS_ICON[state.id],
}));

const DATA = board();

/**
 * The board, built from the `/table` parts rather than the `DataTable` preset: row selection,
 * facet filters and column visibility only exist down here, and the selection then drives an
 * `ActionBar`.
 */
export function BoardTable() {
  const table = useDataTable({ columns: COLUMNS, data: DATA, pageSize: 6 });
  const selected = table.getFilteredSelectedRowModel().rows;

  return (
    <DataTableRoot table={table}>
      <DataTableToolbar id="tour-board-toolbar">
        <DataTableSearch column="title" placeholder="Search contracts…" />
        <DataTableFacetFilter column="status" label="State" options={STATUS_OPTIONS} />
        <DataTableFacetFilter column="region" label="Region" />
        <DataTableViewOptions className="ms-auto" />
      </DataTableToolbar>

      {/* `stickyHeader` with a `maxHeight`, which is the pair rather than the prop: pinning to the
          enclosing region alone costs the wrapper's sideways scroll, and at 430px these six
          columns are wider than the box — Due and Posted went out of reach. Given a height the
          wrapper scrolls again on both axes and the header pins to it. 28rem clears six rows, so
          the vertical scroll only appears once the page size grows. */}
      <DataTableContent<Quest>
        empty="No contracts match these filters."
        maxHeight="28rem"
        onRowClick={(contract) =>
          toast.create({
            title: contract.title,
            description: `${hallOf(contract).short} · ${contract.region}`,
            type: "info",
          })
        }
        stickyHeader
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
            onClick={() =>
              toast.create({ title: `Re-posting ${selected.length} contracts`, type: "info" })
            }
            size="sm"
            variant="ghost"
          >
            <RotateCwIcon />
            Re-post
          </Button>
          <Button
            onClick={() => toast.create({ title: "Ledger export queued", type: "success" })}
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
