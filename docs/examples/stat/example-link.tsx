import { UsersIcon } from "lucide-react";
import { StatDescription, StatIndicator, StatLabel, StatRoot, StatValue } from "@kanzo-tech/ui";
import { availableNow } from "@/example/roster";

export default function Example() {
  return (
    <StatRoot asChild className="w-full max-w-xs" variant="success">
      <a href="#the-roster">
        <StatIndicator>
          <UsersIcon />
        </StatIndicator>
        <StatLabel>Members ready</StatLabel>
        <StatValue>{availableNow().length}</StatValue>
        <StatDescription>who can be sent today</StatDescription>
      </a>
    </StatRoot>
  );
}
