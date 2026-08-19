import { Badge, DataList, DataListItem, DataListItemLabel, DataListItemValue } from "@kanzo-tech/ui";
import { board } from "@/example/quests";

const contract = board()[0]!;

export default function Example() {
  return (
    <DataList className="w-full max-w-sm">
      <DataListItem>
        <DataListItemLabel>Contract</DataListItemLabel>
        <DataListItemValue>{contract.id}</DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>Posted</DataListItemLabel>
        <DataListItemValue>{contract.title}</DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>Region</DataListItemLabel>
        <DataListItemValue>{contract.region}</DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>State</DataListItemLabel>
        <DataListItemValue>
          <Badge size="xs" variant="outline">
            {contract.status}
          </Badge>
        </DataListItemValue>
      </DataListItem>
    </DataList>
  );
}
