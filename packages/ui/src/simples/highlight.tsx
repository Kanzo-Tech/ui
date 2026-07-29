"use client";

import {
  Highlight as ArkHighlight,
  type HighlightProps as ArkHighlightProps,
} from "@ark-ui/react/highlight";
import { cn } from "../lib/cn";

export interface HighlightProps extends ArkHighlightProps {}

// Ark's Highlight splits `text` into chunks and wraps each match in a `<mark>`,
// forwarding `className`/`data-*` to every match. We token-theme the mark so it
// never falls back to the browser's yellow default — `bg-match`, the same token
// the editor paints a search hit with, because they are the same decision.
export const Highlight = (props: HighlightProps) => {
  const { className, ...rest } = props;

  return (
    <ArkHighlight
      className={cn(
        "rounded-sm px-0.5",
        "bg-match text-foreground",
        "font-medium",
        className
      )}
      data-slot="highlight"
      {...rest}
    />
  );
};
