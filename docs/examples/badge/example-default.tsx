import { Badge } from "@kanzo-tech/ui";
import { QUESTS } from "@/example/quests";
import { questStatus } from "@/example/world";

const contracts = QUESTS.slice(0, 3);

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      {contracts.map((contract) => (
        <div className="flex items-center justify-between gap-3" key={contract.id}>
          <span className="truncate">{contract.title}</span>
          <Badge variant={questStatus(contract.status).tone}>
            {questStatus(contract.status).label}
          </Badge>
        </div>
      ))}
    </div>
  );
}
