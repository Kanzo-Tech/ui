import { Swatch } from "@kanzo-tech/ui";
import { HALLS, hall } from "@/example/world";

const amber = hall("amber").heraldry.brand;

export default function Example() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-4">
        <Swatch color={amber} shape="square" size="md" />
        <Swatch color={amber} shape="round" size="md" />
      </div>

      {/* The label carries the identity; the swatch only repeats it in colour. */}
      <ul className="flex flex-col gap-1.5">
        {HALLS.map((entry) => (
          <li className="flex items-center gap-2" key={entry.id}>
            <Swatch color={entry.heraldry.brand} shape="round" size="xs" />
            {entry.short}
          </li>
        ))}
      </ul>
    </div>
  );
}
