import { DataList, DataListItem, DataListItemLabel, DataListItemValue } from "@kanzo-tech/ui";
import { board } from "@/example/quests";

const contract = board()[0]!;

/** What an aside wants: a 6rem label column would leave the value nothing to sit in. */
export default function Example() {
  return (
    <DataList className="w-full max-w-56" orientation="vertical">
      <DataListItem>
        <DataListItemLabel className="text-xs">Contract</DataListItemLabel>
        <DataListItemValue className="break-all">{contract.id}</DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel className="text-xs">Posted</DataListItemLabel>
        <DataListItemValue>{contract.title}</DataListItemValue>
      </DataListItem>
    </DataList>
  );
}
