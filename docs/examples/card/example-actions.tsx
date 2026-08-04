import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@kanzo-tech/ui";
import { dueOn, quest } from "@/example/quests";
import { GRADES, questStatus } from "@/example/world";

const contract = quest("Q-1041");
const grade = GRADES.find((entry) => entry.value === contract.grade);

/** `CardAction` sits in the header, opposite the title; `CardFooter` sits at the bottom. Both
 *  exist because "an action on a card" means two different placements. */
export default function Example() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>{contract.title}</CardTitle>
        <CardDescription>
          {contract.region} · due {dueOn(contract)}
        </CardDescription>
        <CardAction>
          <Badge variant={questStatus(contract.status).tone}>
            {questStatus(contract.status).label}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="text-muted-foreground text-sm">
        Grade {contract.grade} — {grade?.label}. Pays {contract.reward} gold.
      </CardContent>

      <CardFooter>
        <Button size="sm" variant="outline">
          Decline
        </Button>
        <Button size="sm">Claim</Button>
      </CardFooter>
    </Card>
  );
}
