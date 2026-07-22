import Link from "next/link";
import { cn } from "@kanzo-tech/ui";
import { getComponentGroups } from "@/lib/component-groups";

/**
 * Every showcase, as a card grid.
 *
 * Same contract as `ComponentsList` and for the same reason: generated from `source.pageTree`,
 * so a showcase appears here exactly when it has a page, and there is no second list to keep
 * in sync.
 *
 * That derivation also settles a distinction that the source directory blurs.
 * `docs/showcases/preferences` uses the standalone-viewport MECHANISM without being a
 * showcase — Preferences is a component whose panel is `Portal`ed and `position: fixed`, so it
 * cannot be rendered inside a framed preview box. It has no page in this group, so it does not
 * appear here; it appears in the components index, which is where a component belongs. A
 * directory listing would have got that wrong.
 */
export const ShowcasesList = ({ className, ...rest }: React.ComponentProps<"div">) => {
  const group = getComponentGroups().find((g) => g.slug === "showcases");
  if (!group) return null;

  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
      {...rest}
    >
      {group.components.map((showcase) => (
        <Link
          className={cn(
            "group flex flex-col gap-1 rounded-xl border p-5 transition-colors",
            "hover:border-primary/40 hover:bg-accent/40",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32",
          )}
          href={showcase.url}
          key={showcase.slug}
        >
          <span className="font-medium text-sm">{showcase.title}</span>
          {showcase.description && (
            <span className="text-muted-foreground text-sm">{showcase.description}</span>
          )}
        </Link>
      ))}
    </div>
  );
};
