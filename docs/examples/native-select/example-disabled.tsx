import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="amber" disabled>
      <NativeSelectOption value="amber">The Amber Hall</NativeSelectOption>
    </NativeSelect>
  );
}
