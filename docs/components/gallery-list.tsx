import Link from "next/link";
import { cn } from "@kanzo-tech/ui";
import { getComponentGroups } from "@/lib/component-groups";

/**
 * One group of pages, as a card grid — the gallery a `full: true` page puts under its prose.
 *
 * Same contract as `ComponentsList` and for the same reason: generated from `source.pageTree`, so
 * a page appears here exactly when it exists on disk, and there is no second list to keep in sync.
 *
 */
export const GalleryList = ({
  group: slug,
  className,
  ...rest
}: React.ComponentProps<"div"> & { group: string }) => {
  const group = getComponentGroups().find((g) => g.slug === slug);
  if (!group) return null;

  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
      {...rest}
    >
      {group.components.map((entry) => (
        <Link
          className={cn(
            "group flex flex-col gap-1 rounded-xl border p-5 no-underline transition-colors",
            "hover:border-primary/40 hover:bg-accent/40",
            "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
          )}
          href={entry.url}
          key={entry.slug}
        >
          <span className="font-medium text-sm">{entry.title}</span>
          {entry.description && (
            <span className="text-muted-foreground text-sm">{entry.description}</span>
          )}
        </Link>
      ))}
    </div>
  );
};
