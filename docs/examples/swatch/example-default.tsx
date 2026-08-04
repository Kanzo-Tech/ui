import { SwatchGroup } from "@kanzo-tech/ui";
import { HALLS } from "@/example/world";

export default function Example() {
  return (
    <ul className="flex w-64 flex-col gap-2 text-sm">
      {HALLS.map((entry) => (
        <li className="flex items-center justify-between gap-3" key={entry.id}>
          {entry.short}
          <SwatchGroup colors={[entry.heraldry.brand, entry.heraldry.base]} />
        </li>
      ))}
    </ul>
  );
}
