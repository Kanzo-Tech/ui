import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="wyrm">
      <NativeSelectOptGroup label="Warm-blooded">
        <NativeSelectOption value="harpy">Harpy</NativeSelectOption>
        <NativeSelectOption value="grimalkin">Grimalkin</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Cold-blooded">
        <NativeSelectOption value="wyrm">Wyrm</NativeSelectOption>
        <NativeSelectOption value="basilisk">Basilisk</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  );
}
