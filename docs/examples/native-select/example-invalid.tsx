import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="" invalid>
      <NativeSelectOption value="">Select a region</NativeSelectOption>
      <NativeSelectOption value="Thornmarch">Thornmarch</NativeSelectOption>
      <NativeSelectOption value="Duskfen">Duskfen</NativeSelectOption>
    </NativeSelect>
  );
}
