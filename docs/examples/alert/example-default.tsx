import { Alert, AlertDescription, AlertTitle } from "@kanzo-tech/ui";
import { openQuests } from "@/example/quests";

export default function Example() {
  return (
    <Alert className="max-w-md">
      <AlertTitle>{openQuests().length} contracts on the board</AlertTitle>
      <AlertDescription>Posted, and anyone chartered may claim them.</AlertDescription>
    </Alert>
  );
}
