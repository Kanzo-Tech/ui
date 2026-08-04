// @kanzo-tech/ui/table — a thin composable layer over TanStack Table.
//
// Kept out of the root barrel so the base bundle never carries @tanstack/react-table.
// Consumers: `import { DataTableRoot, useDataTable } from "@kanzo-tech/ui/table"`.
//
// `useDataTable` owns the engine (row models, state slices, the server-side modes); the parts own
// the chrome. Compose the two — column visibility, facet filters, row selection and manual paging
// all live in the parts, so the composition is the only shape that reaches them.
//
// There is no `DataTable` preset. It was `useDataTable` plus four parts with the toolbar's tree
// flattened into `searchKey` / `searchPlaceholder` / `toolbarActions` / `empty`, and its own doc
// comment conceded as much. `docs/examples/data-table/example-complete.tsx` already *is* the
// composition, which is the honest home for an arrangement.
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
