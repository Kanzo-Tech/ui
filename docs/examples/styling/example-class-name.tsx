import { Button } from "@kanzo-tech/ui";

/**
 * The third escape hatch, and the one with a trap worth seeing.
 *
 * `className` is merged with `tailwind-merge`, so a utility in the same group as the recipe's
 * *replaces* it rather than fighting it on specificity — `rounded-full` wins over the recipe's
 * `rounded-md` with no `!` and no longer selector.
 *
 * The trap is that this only works within a group tailwind-merge knows. A token-backed utility is
 * still the better reach when one exists: the third button asks for a tint of `--foreground`, so it
 * stays right when the reader changes theme, while a raw colour would not.
 */
export default function Example() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">As drawn</Button>
        <Button className="rounded-full" size="sm">
          rounded-full wins
        </Button>
        <Button className="bg-foreground/17 text-foreground hover:bg-foreground/30" size="sm" variant="ghost">
          a token tint
        </Button>
      </div>

      <p className="text-muted-foreground text-sm">
        The last one spells <code>bg-foreground/17</code>: a percentage of a theme token, which
        compiles to <code>color-mix(in oklab, var(--foreground) 17%, transparent)</code> and so
        follows whichever theme is on.
      </p>
    </div>
  );
}
