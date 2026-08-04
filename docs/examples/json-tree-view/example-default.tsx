import { JsonTreeView } from "@kanzo-tech/ui";
import { quest } from "@/example/quests";

export default function Example() {
  return (
    <div className="w-full max-w-md">
      <JsonTreeView data={quest("Q-1041")} defaultExpandedDepth={2} />
    </div>
  );
}
