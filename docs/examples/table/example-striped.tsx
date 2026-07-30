import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { ROLES } from "@/example/world";

export default function Example() {
  return (
    <Table variant="striped">
      <TableHeader>
        <TableRow>
          <TableHead>Role</TableHead>
          <TableHead>Duty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROLES.map((role) => (
          <TableRow key={role.id}>
            <TableCell>{role.label}</TableCell>
            <TableCell className="text-muted-foreground">{role.duty}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
