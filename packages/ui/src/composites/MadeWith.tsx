import type { ReactNode } from "react";
import { HeartIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { Link } from "../simples/Link";

/** The words around the brand. English by default; the brand is the caller's and is never a word here. */
export interface MadeWithTranslations {
  /** Before the heart. */
  prefix: string;
  /** Between the heart and the brand. */
  infix: string;
  /** The heart's accessible name — it is read aloud, so it is a word, not a glyph. */
  loveLabel: string;
}

const ENGLISH: MadeWithTranslations = { prefix: "Made with", infix: "at", loveLabel: "love" };

export interface MadeWithProps {
  /**
   * Where the brand points. Omit for a plain, unlinked line.
   *
   * There is no `linkComponent`. A caller with a routed anchor composes the line
   * itself — it is four elements.
   */
  href?: string;
  translations?: Partial<MadeWithTranslations>;
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
 * children and has no default, so the library names nobody; the English words
 * are `translations` with English defaults, which is a convenience a caller can
 * translate rather than a domain the component carries. It also drops
 * `linkComponent`, the routing seam that went with `composites/link.tsx`.
 *
 * *What would reverse this:* a second product finding the sentence shape wrong —
 * a different word order, a brand that is not at the end, a line that needs two
 * links. At that point this is a layout with one arrangement pretending to be a
 * component, and the honest answer is that four elements are cheap to write.
 */
export function MadeWith({ href, translations, className, children }: MadeWithProps) {
  const t = { ...ENGLISH, ...translations };
  return (
    <p
      data-slot="made-with"
      className={cn("inline-flex items-center gap-1 text-muted-foreground text-xs", className)}
    >
      {t.prefix}
      <HeartIcon role="img" aria-label={t.loveLabel} className="size-3.5 fill-destructive text-destructive" />
      {t.infix}
      {href ? <Link href={href}>{children}</Link> : <span className="font-medium text-foreground">{children}</span>}
    </p>
  );
}
