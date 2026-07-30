import type { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "../simples/checkbox.js";

export interface SelectColumnOptions<TData> {
  /** aria-label for the header checkbox. */
  headerLabel?: string;
  /** Column id. Default "select". */
  id?: string;
  /** aria-label for a row checkbox. Default `Select row <n>`. */
  rowLabel?: (row: Row<TData>) => string;
}

/**
 * A leading checkbox column. The header reflects a partial page as `indeterminate`, and both
 * checkboxes carry a real label — the visual column has no header text to borrow. The cell
 * stops click propagation so it stays inert under `DataTableContent`'s `onRowClick`.
 */
export function selectColumn<TData>(
  options: SelectColumnOptions<TData> = {},
): ColumnDef<TData, unknown> {
  const {
    headerLabel = "Select all rows on this page",
    id = "select",
    rowLabel = (row: Row<TData>) => `Select row ${row.index + 1}`,
  } = options;

  return {
    cell: ({ row }) => (
      <Checkbox
        aria-label={rowLabel(row)}
        checked={row.getIsSelected()}
        data-slot="data-table-select-row"
        disabled={!row.getCanSelect()}
        onCheckedChange={(details) => row.toggleSelected(details.checked === true)}
        onClick={(event) => event.stopPropagation()}
      />
    ),
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => (
      <Checkbox
        aria-label={headerLabel}
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        data-slot="data-table-select-all"
        onCheckedChange={(details) => table.toggleAllPageRowsSelected(details.checked === true)}
      />
    ),
    id,
  };
}
