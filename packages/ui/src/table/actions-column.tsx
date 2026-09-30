"use client";

import type { ColumnDef, Row } from "@tanstack/react-table";
import { EllipsisIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../simples/button.js";
import { Menu, MenuContent, MenuTrigger } from "../simples/menu.js";

export interface ActionsColumnOptions<TData> {
  /** Visually hidden header text, so the column is not an empty `<th>`. Default "Actions". */
  headerLabel?: string;
  /** Column id. Default "actions". */
  id?: string;
  /** aria-label for a row's trigger. It names the row — the icon has no text to borrow. */
  label: (row: Row<TData>) => string;
  /** The row's menu items — `MenuItem`, `MenuSeparator`, `MenuGroup`. `null` renders no trigger. */
  menu: (row: Row<TData>) => ReactNode;
}

// The trigger at `--size-field: 0.25rem` (28px) plus the cell's `p-2`. A floor, not a clamp: in
// an auto-layout table a wider density's trigger still wins, and the column takes no slack.
const WIDTH = 44;

/**
 * A trailing row-menu column. A row with nothing permitted gets no trigger rather than an empty
 * menu. The trigger and the menu both stop click propagation so neither fires
 * `DataTableContent`'s `onRowClick` — the menu too, because a portal's events bubble through the
 * React tree to the row regardless of where the DOM put them.
 */
export function actionsColumn<TData>(
  options: ActionsColumnOptions<TData>,
): ColumnDef<TData, unknown> {
  const { headerLabel = "Actions", id = "actions", label, menu } = options;

  return {
    cell: ({ row }) => {
      const items = menu(row);
      if (items == null) return null;

      return (
        <div className="flex justify-end">
          <Menu>
            <MenuTrigger asChild>
              <Button
                aria-label={label(row)}
                onClick={(event) => event.stopPropagation()}
                size="icon-sm"
                variant="ghost"
              >
                <EllipsisIcon />
              </Button>
            </MenuTrigger>
            <MenuContent onClick={(event) => event.stopPropagation()}>{items}</MenuContent>
          </Menu>
        </div>
      );
    },
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="sr-only">{headerLabel}</span>,
    id,
    maxSize: WIDTH,
    minSize: WIDTH,
    size: WIDTH,
  };
}
