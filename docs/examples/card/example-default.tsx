import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kanzo-tech/ui";
import { quest } from "@/example/quests";
import { hall } from "@/example/world";

const contract = quest("Q-1041");

export default function Example() {
  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>{contract.title}</CardTitle>
        <CardDescription>
          {contract.id} · {contract.region} · {contract.reward} gold
        </CardDescription>
      </CardHeader>
      <CardContent>Posted by {hall(contract.hall).name}.</CardContent>
    </Card>
  );
}
