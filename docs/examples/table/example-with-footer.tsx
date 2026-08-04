import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { boardValue, questsOf } from "@/example/quests";
import { HALLS } from "@/example/world";

const rows = HALLS.map((entry) => ({
  hall: entry.short,
  gold: questsOf(entry.id).reduce((sum, contract) => sum + contract.reward, 0),
}));

export default function Example() {
  return (
    <Table isHoverable={false}>
      <TableHeader>
        <TableRow>
          <TableHead>Hall</TableHead>
          <TableHead className="text-right">Posted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.hall}>
            <TableCell>{row.hall}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.gold.toLocaleString()} gold
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>On the board</TableCell>
          <TableCell className="text-right tabular-nums">
            {boardValue().toLocaleString()} gold
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
