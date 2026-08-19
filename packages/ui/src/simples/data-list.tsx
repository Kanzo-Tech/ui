// A record read back: label · value, as a real `<dl>`. Presentational (`ark.*`), no client
// boundary.
//
// Shark's `data-list.tsx`, adopted verbatim in structure and class list. It was UNADOPTED with the
// reason "no renderer in the library or the docs" until two appeared at once — the graph
// inspector's node properties and the receipts showcase's ticket record, both of which had
// hand-written the same `dl` / `div` / `dt` / `dd` tree with the same three utility classes.
//
// The one thing to understand before using it: `orientation` is a `data-` attribute on the ROOT and
// every child styles off `group-data-[orientation=…]`, so a mixed list is not expressible — which is
// right. A record whose rows sometimes stack and sometimes sit side by side is two records.

import { ark } from "@ark-ui/react/factory";
import type React from "react";
import { cn } from "../lib/cn";

export interface DataListProps extends React.ComponentProps<typeof ark.dl> {
  /**
   * Label beside the value, or above it.
   *
   * `horizontal` is Shark's default and reads as a table of two columns; `vertical` is what a
   * narrow aside wants, where a 6rem label column would leave nothing for the value.
   *
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical";
}

export const DataList = (props: DataListProps) => {
  const { orientation = "horizontal", className, slot, ...rest } = props;

  return (
    <ark.dl
      className={cn("group/data-list", "flex flex-col gap-1", "text-sm", className)}
      data-orientation={orientation}
      {...rest}
      data-slot={slot ?? "data-list"}
    />
  );
};

/**
 * One row, and the element the `dl` needs between itself and the pair.
 *
 * A `dl` may contain nothing but `dt`, `dd` and a `div` wrapping them, which is why this exists at
 * all: anything else here — a `p` beside the value, a `span` for a message — is invalid HTML that
 * every browser renders anyway. Put it inside {@link DataListItemValue}.
 */
export const DataListItem = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex gap-4 py-2",
        "group-data-[orientation=horizontal]/data-list:flex-row group-data-[orientation=horizontal]/data-list:items-center",
        "group-data-[orientation=vertical]/data-list:flex-col group-data-[orientation=vertical]/data-list:gap-1",
        className,
      )}
      {...rest}
      data-slot={slot ?? "data-list-item"}
    />
  );
};

export const DataListItemLabel = (props: React.ComponentProps<typeof ark.dt>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.dt
      className={cn(
        "min-w-24 shrink-0",
        "font-medium text-muted-foreground",
        "group-data-[orientation=vertical]/data-list:min-w-0",
        className,
      )}
      {...rest}
      data-slot={slot ?? "data-list-item-label"}
    />
  );
};

export const DataListItemValue = (props: React.ComponentProps<typeof ark.dd>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.dd
      className={cn("flex-1", "text-foreground", className)}
      {...rest}
      data-slot={slot ?? "data-list-item-value"}
    />
  );
};
