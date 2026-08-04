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
import { questsOf } from "@/example/quests";
import { questStatus } from "@/example/world";

const contracts = questsOf("amber").slice(0, 4);

export default function Example() {
  return (
    <Table>
      <TableCaption>Contracts the Amber Hall has on the board.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Contract</TableHead>
          <TableHead>Region</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((contract) => (
          <TableRow key={contract.id}>
            <TableCell>{contract.title}</TableCell>
            <TableCell>{contract.region}</TableCell>
            <TableCell>
              <Badge variant={questStatus(contract.status).tone}>
                {questStatus(contract.status).label}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
