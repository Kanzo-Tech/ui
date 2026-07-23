import type { ReactNode } from "react";
import { HeartIcon } from "lucide-react";
import { cn } from "../lib/cn.js";
import { DefaultLink, type LinkComponent } from "./link.js";

export interface MadeWithProps {
  /** Brand name (default "Kanzo"). */
  by?: ReactNode;
  /** Make the brand a link (e.g. to the homepage). */
  href?: string;
  linkComponent?: LinkComponent;
  className?: string;
}

/**
 * MadeWith — a "Made with ♥ at <brand>" attribution line, brand set via `by` (default Kanzo) (sourced from metadata-form).
 * Domain-free, token-native. The heart carries an accessible name so it reads as
 * "Made with love at Kanzo".
 */
export function MadeWith({ by = "Kanzo", href, linkComponent: Link = DefaultLink, className }: MadeWithProps) {
  const brand = href ? (
    <Link href={href} className="font-medium text-foreground hover:underline">
      {by}
    </Link>
  ) : (
    <span className="font-medium text-foreground">{by}</span>
  );
  return (
    <p
      data-slot="made-with"
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
    >
      Made with
      <HeartIcon role="img" aria-label="love" className="size-3.5 fill-destructive text-destructive" />
      at {brand}
    </p>
  );
}
MadeWith.displayName = "MadeWith";
