"use client";

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn.js";
import { NativeSelect, NativeSelectOption } from "../simples/native-select.js";
import {
  Pagination,
  PaginationEllipsis,
  PaginationItem,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  type PaginationTranslations,
  usePagination,
} from "../simples/pagination.js";
import { useDataTableContext } from "./data-table-root.js";

/** The words around the pages, and `Pagination`'s own, which pass through to it. */
export interface DataTablePaginationTranslations extends PaginationTranslations {
  /** The selection count, against the filtered rows. */
  selected: (count: number, total: number) => string;
  /** The page-size selector's label, and its accessible name. */
  rowsPerPage: string;
}

const ENGLISH: Pick<DataTablePaginationTranslations, "selected" | "rowsPerPage"> = {
  selected: (count, total) => `${count} of ${total} row(s) selected.`,
  rowsPerPage: "Rows per page",
};

export interface DataTablePaginationProps extends React.ComponentProps<typeof ark.div> {
  /** Offer a rows-per-page selector with these sizes. Omitted = no selector. */
  pageSizes?: number[];
  translations?: Partial<DataTablePaginationTranslations>;
}

export const DataTablePagination = (props: DataTablePaginationProps) => {
  const { pageSizes, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const table = useDataTableContext();

  const { pageIndex, pageSize } = table.getState().pagination;
  const selected = table.getFilteredSelectedRowModel().rows.length;
  const multiPage = table.getPageCount() > 1;

  // Nothing to page, nothing selected, no size selector: the row would be empty chrome.
  if (!multiPage && selected === 0 && !pageSizes) return null;

  return (
    <ark.div
      className={cn("flex items-center gap-3", className)}
      {...rest}
      data-slot={slot ?? "data-table-pagination"}
    >
      {selected > 0 && (
        <span className="text-muted-foreground text-sm" data-slot="data-table-selected-count">
          {t.selected(selected, table.getFilteredRowModel().rows.length)}
        </span>
      )}

      <div className="ms-auto flex items-center gap-3">
        {pageSizes && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">{t.rowsPerPage}</span>
            <NativeSelect
              aria-label={t.rowsPerPage}
              onChange={(event) => table.setPageSize(Number(event.target.value))}
              size="sm"
              value={pageSize}
            >
              {pageSizes.map((size) => (
                <NativeSelectOption key={size} value={size}>
                  {size}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}

        {/* Ark is 1-based, TanStack 0-based: page = pageIndex + 1 closes the loop. */}
        {multiPage && (
          <Pagination
            count={table.getRowCount()}
            onPageChange={(details) => table.setPageIndex(details.page - 1)}
            page={pageIndex + 1}
            pageSize={pageSize}
            translations={translations}
          >
            <PaginationPrevTrigger />
            <DataTablePages />
            <PaginationNextTrigger />
          </Pagination>
        )}
      </div>
    </ark.div>
  );
};

function DataTablePages() {
  const pagination = usePagination();

  return (
    <>
      {pagination.pages.map((page, index) =>
        page.type === "page" ? (
          <PaginationItem key={page.value} type="page" value={page.value}>
            {page.value}
          </PaginationItem>
        ) : (
          <PaginationEllipsis index={index} key={`ellipsis-${index}`} />
        ),
      )}
    </>
  );
}
