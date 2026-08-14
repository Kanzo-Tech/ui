import { Badge, Button } from "@kanzo-tech/ui";

/**
 * The third escape hatch, and the one with a trap worth seeing.
 *
 * `className` is merged with `tailwind-merge`, so a utility in the same group as the recipe's
 * *replaces* it rather than fighting it on specificity — `rounded-full` wins over the recipe's
 * `rounded-md` with no `!` and no longer selector.
 *
 * The trap is that this only works within a group tailwind-merge knows. A token-backed utility is
 * still the better reach when one exists: the third button asks for a level from the reference
 * tier, so it stays right when the reader changes palette, while a raw utility would not.
 */
export default function Example() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">As drawn</Button>
        <Button className="rounded-full" size="sm">
          rounded-full wins
        </Button>
        <Button className="bg-base-a5 text-foreground hover:bg-base-a6" size="sm" variant="ghost">
          a reference step
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        The last one spells <code>bg-base-a5</code> rather than a percentage: an alpha step is solved
        against each mode&apos;s own ramp, so it is right in light and dark, while{" "}
        <code>bg-base/5</code> lands on a different step in each.{" "}
        <Badge variant="secondary">a4</Badge> in light is <Badge variant="secondary">a3</Badge> in
        dark for the same number.
      </p>
    </div>
  );
}
