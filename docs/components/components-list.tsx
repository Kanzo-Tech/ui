import Link from "next/link";
import { cn } from "@kanzo-tech/ui";
import { getComponentGroups } from "@/lib/component-groups";

/**
 * Every documented component, as a card grid, grouped by layer.
 *
 * Generated from `source.pageTree` via `lib/component-groups` — there is no list of components
 * in this file and there must never be one. Shark UI's grid is page-tree-driven too, but each
 * card is gated on a hand-kept thumbnail map, so a component absent from that map vanishes from
 * the grid with nothing failing. Here a page on disk is the whole contract: it appears, titled
 * and described by its own frontmatter.
 *
 * Consequently the cards carry text, not thumbnails. A thumbnail per component is a second
 * source of truth by construction — the point of this page is that there is only one.
 */
export const ComponentsList = ({ className, ...rest }: React.ComponentProps<"div">) => {
  const groups = getComponentGroups();

  return (
    <div className={cn("flex flex-col gap-12", className)} {...rest}>
      {groups.map((group) => (
        <section key={group.slug}>
          <div className="mb-4 flex items-baseline gap-3">
            <h2
              className="scroll-m-20 font-semibold text-xl tracking-tight"
              id={group.slug}
            >
              {group.title}
            </h2>
            <span className="text-muted-foreground text-sm tabular-nums">
              {group.components.length}
            </span>
          </div>

          {group.description && (
            <p className="mb-4 text-muted-foreground text-sm">{group.description}</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.components.map((component) => (
              <Link
                className={cn(
                  "flex flex-col gap-1 rounded-xl border bg-card p-4 no-underline",
                  "text-card-foreground transition-colors hover:bg-accent",
                  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32",
                )}
                href={component.url}
                key={component.url}
              >
                <span className="font-medium text-sm">{component.title}</span>
                {component.description && (
                  <span className="line-clamp-3 text-muted-foreground text-xs">
                    {component.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
