import {
  Badge,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";

const datasets = [
  { name: "customers", records: "1,204", status: "Mapped" },
  { name: "orders", records: "8,912", status: "Pending" },
  { name: "invoices", records: "412", status: "Mapped" },
];

export default function Example() {
  return (
    <Table>
      <TableCaption>Datasets ingested this week.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Dataset</TableHead>
          <TableHead>Records</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {datasets.map((dataset) => (
          <TableRow key={dataset.name}>
            <TableCell>{dataset.name}</TableCell>
            <TableCell>{dataset.records}</TableCell>
            <TableCell>
              <Badge
                variant={dataset.status === "Mapped" ? "success" : "warning"}
              >
                {dataset.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
