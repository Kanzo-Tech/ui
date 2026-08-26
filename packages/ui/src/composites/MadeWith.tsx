import type { ReactNode } from "react";
import { HeartIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { Link } from "../simples/Link";

export interface MadeWithProps {
  /**
   * Where the brand points. Omit for a plain, unlinked line.
   *
   * There is no `linkComponent`: a router reaches the anchor through `asChild` on
   * `Link`, which works on every part rather than the one a prop was wired to. A
   * caller with a routed anchor composes the line itself — it is four elements.
   */
  href?: string;
  /** Words before the heart. Replace to translate. */
  prefix?: string;
  /** Words between the heart and the brand. Replace to translate. */
  infix?: string;
  /** Accessible name for the heart — it is read aloud, so it is a word, not a glyph. */
  loveLabel?: string;
  className?: string;
  /** The brand. Required, and children rather than a prop: it is markup. */
  children: ReactNode;
}

/**
 * "Made with ♥ at <brand>" — an attribution line, styled once.
 *
 * **Re-admitted after deletion, and narrower than what was deleted.** `396bfd7`
 * removed the original with a charge worth keeping in view: it "hard-coded the
 * English 'Made with' and defaulted `by` to 'Kanzo', a brand name in a library
 * whose first admission rule is domain-freedom". Both are gone. The brand is
 * children and has no default, so the library names nobody; the two English words
 * are props with English defaults, which is a convenience a caller can translate
 * rather than a domain the component carries. It also drops `linkComponent`, the
 * routing seam that went with `composites/link.tsx`.
 *
 * *What would reverse this:* a second product finding the sentence shape wrong —
 * a different word order, a brand that is not at the end, a line that needs two
 * links. At that point this is a layout with one arrangement pretending to be a
 * component, and the honest answer is that four elements are cheap to write.
 */
export function MadeWith({
  href,
  prefix = "Made with",
  infix = "at",
  loveLabel = "love",
  className,
  children,
}: MadeWithProps) {
  return (
    <p
      data-slot="made-with"
      className={cn("inline-flex items-center gap-1 text-muted-foreground text-xs", className)}
    >
      {prefix}
      <HeartIcon role="img" aria-label={loveLabel} className="size-3.5 fill-destructive text-destructive" />
      {infix}
      {href ? <Link href={href}>{children}</Link> : <span className="font-medium text-foreground">{children}</span>}
    </p>
  );
}
