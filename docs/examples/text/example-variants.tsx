import { Text } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2">
      <Text>Default</Text>
      <Text variant="muted">Muted</Text>
      <Text variant="primary">Primary</Text>
      <Text variant="destructive">Destructive</Text>
    </div>
  );
}
