import { NativeSelect, NativeSelectOption } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-start gap-2">
      {(["sm", "md", "lg"] as const).map((size) => (
        <NativeSelect className="w-56" defaultValue="ttl" key={size} size={size}>
          <NativeSelectOption value="ttl">Turtle</NativeSelectOption>
          <NativeSelectOption value="jsonld">JSON-LD</NativeSelectOption>
        </NativeSelect>
      ))}
    </div>
  );
}
