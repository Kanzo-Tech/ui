// @kanzo-tech/ui/table — a thin composable layer over TanStack Table.
//
// Kept out of the root barrel so the base bundle never carries @tanstack/react-table.
// Consumers: `import { DataTable, useDataTable } from "@kanzo-tech/ui/table"`.
//
// `useDataTable` owns the engine (row models, state slices, the server-side modes); the parts own
// the chrome. `DataTable` is the batteries-included preset built from both — reach for the parts
// when its shape is the wrong one, which is where column visibility, facet filters, row selection
// and manual paging live.
export { DataTable } from "./table/DataTable.js";
export type { DataTableProps } from "./table/DataTable.js";

export { useDataTable, facetFilterFn } from "./table/use-data-table.js";
export type { UseDataTableOptions } from "./table/use-data-table.js";

export { DataTableRoot, useDataTableContext } from "./table/data-table-root.js";
export type { DataTableRootProps } from "./table/data-table-root.js";

export {
  DataTableToolbar,
  DataTableSearch,
  DataTableFacetFilter,
  DataTableViewOptions,
} from "./table/data-table-toolbar.js";
export type {
  DataTableSearchProps,
  DataTableFacetOption,
  DataTableFacetFilterProps,
  DataTableViewOptionsProps,
} from "./table/data-table-toolbar.js";

export { DataTableContent } from "./table/data-table-content.js";
export type { DataTableContentProps } from "./table/data-table-content.js";

export { DataTablePagination } from "./table/data-table-pagination.js";
export type { DataTablePaginationProps } from "./table/data-table-pagination.js";

export { selectColumn } from "./table/select-column.js";
export type { SelectColumnOptions } from "./table/select-column.js";

// Split from DataTable's module so React Fast Refresh sees a component-only file (a mixed
// component + factory export makes it bail, corrupting the hot module).
export { sortableHeader } from "./table/sortableHeader.js";

// Re-exported so a consumer types its columns without a direct TanStack import. `HeaderContext`
// is here because wrapping `sortableHeader` needs it, and needing a direct @tanstack import to
// type your own header defeats the point of the other four.
export type {
  CellContext, ColumnDef, HeaderContext, Row, Table,
} from "@tanstack/react-table";
