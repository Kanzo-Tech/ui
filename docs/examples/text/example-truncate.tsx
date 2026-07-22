import { Text } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="w-56 rounded-md border p-3">
      {/* `as="p"` because truncation needs a block box — an inline span cannot clip. */}
      <Text as="p" truncate variant="muted">
        urn:kanzo:dataset:customers:2024-11-04T09:15:00Z:snapshot
      </Text>
    </div>
  );
}
