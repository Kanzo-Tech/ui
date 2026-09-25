import { DataList, DataListItem, DataListItemLabel, DataListItemValue, FormatByte, FormatNumber, FormatRelativeTime } from "@kanzo-tech/ui";

export default function Example() {
  // Relative to now on both sides, so a page prerendered days ago still hydrates to the same text.
  const modified = new Date(Date.now() - 3 * 86_400_000);

  return (
    <DataList className="w-72">
      <DataListItem>
        <DataListItemLabel>Size</DataListItemLabel>
        <DataListItemValue>
          <FormatByte value={48_213_504} />
        </DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>Rows</DataListItemLabel>
        <DataListItemValue>
          <FormatNumber value={1_284_390} />
        </DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>Coverage</DataListItemLabel>
        <DataListItemValue>
          <FormatNumber maximumFractionDigits={1} style="percent" value={0.9372} />
        </DataListItemValue>
      </DataListItem>
      <DataListItem>
        <DataListItemLabel>Modified</DataListItemLabel>
        <DataListItemValue>
          <FormatRelativeTime numeric="auto" value={modified} />
        </DataListItemValue>
      </DataListItem>
    </DataList>
  );
}
