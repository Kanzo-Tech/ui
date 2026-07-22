import { DatabaseIcon } from "lucide-react";
import { StatCard } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatCard
        description="connections configured"
        icon={<DatabaseIcon />}
        label="Connections"
        loading
        value="4"
      />
      <StatCard
        description="connections configured"
        icon={<DatabaseIcon />}
        label="Connections"
        value="4"
      />
    </div>
  );
}
