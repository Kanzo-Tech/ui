import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <NativeSelect className="w-56" defaultValue="ttl">
      <NativeSelectOptGroup label="Triples">
        <NativeSelectOption value="ttl">Turtle</NativeSelectOption>
        <NativeSelectOption value="nt">N-Triples</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Quads">
        <NativeSelectOption value="trig">TriG</NativeSelectOption>
        <NativeSelectOption value="nq">N-Quads</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  );
}
