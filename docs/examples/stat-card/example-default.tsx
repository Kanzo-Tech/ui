import { DatabaseIcon } from "lucide-react";
import { StatCard } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <StatCard
      description="connections configured"
      icon={<DatabaseIcon />}
      label="Connections"
      value="4"
    />
  );
}
