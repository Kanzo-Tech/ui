// Optional subpath: DataTable over TanStack Table.
//
// Kept out of the root barrel so the base bundle never carries @tanstack/react-table.
// Consumers: `import { DataTable, sortableHeader } from "@kanzo-tech/ui/table"`.
export { DataTable } from "./table/DataTable.js";
export type { DataTableProps } from "./table/DataTable.js";
// Split from DataTable's module so React Fast Refresh sees a component-only file (a mixed
// component + factory export makes it bail, corrupting the hot module).
export { sortableHeader } from "./table/sortableHeader.js";

// Re-exported so a consumer types its columns without a direct TanStack import.
export type { ColumnDef, Row, CellContext } from "@tanstack/react-table";
