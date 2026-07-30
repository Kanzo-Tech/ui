import { Separator } from "@kanzo-tech/ui";
import { hall } from "@/example/world";

const amber = hall("amber");

export default function Example() {
  return (
    <div className="w-72 space-y-3 text-sm">
      <p>{amber.name}</p>
      <Separator />
      <p className="text-muted-foreground">
        {amber.seat} · chartered {amber.founded}
      </p>
    </div>
  );
}
