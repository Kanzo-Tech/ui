import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";

const rows = [
  { field: "id", type: "xsd:string" },
  { field: "email", type: "xsd:string" },
  { field: "createdAt", type: "xsd:dateTime" },
  { field: "balance", type: "xsd:decimal" },
];

export default function Example() {
  return (
    <Table variant="striped">
      <TableHeader>
        <TableRow>
          <TableHead>Field</TableHead>
          <TableHead>Datatype</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.field}>
            <TableCell>{row.field}</TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {row.type}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
