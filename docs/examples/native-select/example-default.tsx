import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="">
      <NativeSelectOption value="">Select a region</NativeSelectOption>
      <NativeSelectOption value="Thornmarch">Thornmarch</NativeSelectOption>
      <NativeSelectOption value="Saltmere">Saltmere</NativeSelectOption>
      <NativeSelectOption value="Ashfall Reach">Ashfall Reach</NativeSelectOption>
      <NativeSelectOption value="Coldiron">Coldiron</NativeSelectOption>
      <NativeSelectOption value="Greenhollow">Greenhollow</NativeSelectOption>
      <NativeSelectOption value="Duskfen">Duskfen</NativeSelectOption>
    </NativeSelect>
  );
}
