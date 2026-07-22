import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";

const rows = [
  { name: "customers", records: 1204 },
  { name: "orders", records: 8912 },
  { name: "invoices", records: 412 },
];

export default function Example() {
  const total = rows.reduce((sum, row) => sum + row.records, 0);

  return (
    <Table isHoverable={false}>
      <TableHeader>
        <TableRow>
          <TableHead>Dataset</TableHead>
          <TableHead className="text-right">Records</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.name}>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.records.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right tabular-nums">
            {total.toLocaleString()}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
