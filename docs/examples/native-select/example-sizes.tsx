import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-start gap-2">
      {(["sm", "md", "lg"] as const).map((size) => (
        <NativeSelect className="w-56" defaultValue="wyrm" key={size} size={size}>
          <NativeSelectOption value="wyrm">Wyrm</NativeSelectOption>
          <NativeSelectOption value="basilisk">Basilisk</NativeSelectOption>
        </NativeSelect>
      ))}
    </div>
  );
}
