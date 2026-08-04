import { Swatch } from "@kanzo-tech/ui";
import { hall } from "@/example/world";

const salt = hall("salt").heraldry.brand;

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <Swatch color={salt} size="xs" />
      <Swatch color={salt} size="sm" />
      <Swatch color={salt} size="md" />
      <Swatch color={salt} size="lg" />
    </div>
  );
}
