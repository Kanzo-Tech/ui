import { Swatch } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <Swatch color="#8be9fd" size="xs" />
      <Swatch color="#8be9fd" size="sm" />
      <Swatch color="#8be9fd" size="md" />
      <Swatch color="#8be9fd" size="lg" />
    </div>
  );
}
