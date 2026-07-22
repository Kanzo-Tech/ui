import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="private" disabled>
      <NativeSelectOption value="private">Private</NativeSelectOption>
    </NativeSelect>
  );
}
