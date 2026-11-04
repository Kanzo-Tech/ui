"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "../simples/checkbox.js";

/** The checkboxes' accessible names — the column has no header text to borrow. */
export interface SelectColumnTranslations<TData> {
  /** The header checkbox. */
  headerLabel: string;
  /** A row's checkbox. Name it by the row's data where it has a name. */
  rowLabel: (row: Row<TData>) => string;
}

const ENGLISH: SelectColumnTranslations<unknown> = {
  headerLabel: "Select all rows on this page",
  rowLabel: (row) => `Select row ${row.index + 1}`,
};

export interface SelectColumnOptions<TData> {
  /** Column id. Default "select". */
  id?: string;
  translations?: Partial<SelectColumnTranslations<TData>>;
}

/**
 * A leading checkbox column. The header reflects a partial page as `indeterminate`, and both
 * checkboxes carry a real label — the visual column has no header text to borrow. The cell
 * stops click propagation so it stays inert under `DataTableContent`'s `onRowClick`.
 */
export function selectColumn<TData>(
  options: SelectColumnOptions<TData> = {},
): ColumnDef<TData, unknown> {
  const { id = "select", translations } = options;
  const { headerLabel, rowLabel }: SelectColumnTranslations<TData> = { ...ENGLISH, ...translations };

  return {
    cell: ({ row }) => (
      <Checkbox
        aria-label={rowLabel(row)}
        checked={row.getIsSelected()}
        slot="data-table-select-row"
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
        slot="data-table-select-all"
        onCheckedChange={(details) => table.toggleAllPageRowsSelected(details.checked === true)}
      />
    ),
    id,
  };
}
