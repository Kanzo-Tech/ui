import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";

/**
 * Prose — a block of rendered long-form content: markdown, a changelog, an article.
 *
 * It is the ONLY typography component in the library, and that is the whole position. There
 * used to be `Heading` and `Text` atoms with `size` / `weight` / `variant` / `align` /
 * `truncate` props — five styling knobs on a `<span>`, which is styling-by-props competing
 * with the utilities, and precisely the ad-hoc styling CONVENTIONS.md exists to prevent. They
 * also had no consumer anywhere in the library: every component styles its own text, which is
 * what Shark does and what the type scale is actually for.
 *
 * So: chrome styles itself, and `Prose` handles the case utilities cannot — a tree of elements
 * you did not author, arriving from a markdown renderer or a CMS.
 */
export const Prose = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("kanzo-prose mx-auto max-w-[65ch]", className)}
      {...rest}
      data-slot={slot ?? "prose"}
    />
  );
};
