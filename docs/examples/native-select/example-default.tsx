import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="">
      <NativeSelectOption value="">Select visibility</NativeSelectOption>
      <NativeSelectOption value="public">Public</NativeSelectOption>
      <NativeSelectOption value="private">Private</NativeSelectOption>
      <NativeSelectOption value="restricted">Restricted</NativeSelectOption>
    </NativeSelect>
  );
}
