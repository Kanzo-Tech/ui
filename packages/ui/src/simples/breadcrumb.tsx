import { ark } from "@ark-ui/react/factory";
import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";

interface BreadcrumbProps extends React.ComponentProps<typeof ark.nav> {
  /**
   * Accessible label for the breadcrumb navigation landmark.
   *
   * @default "Breadcrumb"
   */
  "aria-label"?: string;
}

export const Breadcrumb = (props: BreadcrumbProps) => {
  const {
    "aria-label": ariaLabel = "Breadcrumb",
    className,
    slot,
    ...rest
  } = props;

  return (
    <ark.nav
      aria-label={ariaLabel}
      // `min-w-0`, which upstream leaves classless. Inside a flex row — a shell header, a toolbar
      // — a `nav` without it refuses to shrink below its content, so the trail stops yielding and
      // pushes whatever sits beside it off the edge instead. Additive, and never worse: a landmark
      // that *can* shrink still only shrinks when the row is short of room.
      className={cn("min-w-0", className)}
      {...rest}
      data-slot={slot ?? "breadcrumb"}
    />
  );
};

export const BreadcrumbList = (props: React.ComponentProps<typeof ark.ol>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.ol
      className={cn(
        "flex flex-wrap items-center gap-1.5 sm:gap-2.5",
        "wrap-break-word text-muted-foreground text-sm",
        className
      )}
      role="list"
      {...rest}
      data-slot={slot ?? "breadcrumb-list"}
    />
  );
};

export const BreadcrumbItem = (props: React.ComponentProps<typeof ark.li>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.li
      className={cn("inline-flex items-center gap-1.5", className)}
      {...rest}
      data-slot={slot ?? "breadcrumb-item"}
    />
  );
};

export const BreadcrumbLink = (props: React.ComponentProps<typeof ark.a>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.a
      className={cn(
        "text-nowrap",
        "rounded-md border border-transparent",
        "transition-colors",
        "hover:text-foreground",
        "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "motion-reduce:transition-none!",
        className
      )}
      {...rest}
      data-slot={slot ?? "breadcrumb-link"}
    />
  );
};

export const BreadcrumbPage = (
  props: React.ComponentProps<typeof ark.span>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      aria-current="page"
      className={cn("font-normal text-foreground", className)}
      {...rest}
      data-slot={slot ?? "breadcrumb-page"}
    />
  );
};

export const BreadcrumbSeparator = (
  props: React.ComponentProps<typeof ark.li>
) => {
  const { children, className, slot, ...rest } = props;

  return (
    <ark.li
      aria-hidden="true"
      className={cn("opacity-64 [&_svg]:size-4", className)}
      role="presentation"
      {...rest}
      data-slot={slot ?? "breadcrumb-separator"}
    >
      {children ?? <ChevronRightIcon />}
    </ark.li>
  );
};

export const BreadcrumbEllipsis = (
  { slot, ...rest }: React.ComponentProps<typeof ark.span>
) => (
  <ark.span
    aria-hidden="true"
    role="presentation"
    {...rest}
    data-slot={slot ?? "breadcrumb-ellipsis"}
  >
    <MoreHorizontalIcon className="size-4" />
  </ark.span>
);
