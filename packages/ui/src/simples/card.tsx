import { ark } from "@ark-ui/react/factory";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

// A card is a self-contained composition → `<article>` (still `asChild`-swappable, e.g. to an
// `<a>` for a clickable card, exactly as before).
export const Card = (props: React.ComponentProps<typeof ark.article>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.article
      className={cn(
        "[--space:--spacing(6)]",
        "group/card",
        "py-(--space)",
        "flex flex-col gap-4",
        "bg-card",
        "text-foreground",
        "has-data-[variant=image]:pt-0 has-data-[slot=card-footer]:pb-0",
        "rounded-box border shadow-xs/5",
        className
      )}
      {...rest}
      data-slot={slot ?? "card"}
    />
  );
};

const cardMediaVariants = tv({
  base: [
    "flex shrink-0 items-center gap-2",
    "[&_svg]:pointer-events-none",
    "px-(--space)",
  ],
  variants: {
    variant: {
      default: "bg-transparent",
      icon: "[&_svg:not([class*='size-'])]:size-4",
      image: [
        "overflow-hidden rounded-t-sm",
        "px-0",
        "[&_img]:size-full [&_img]:object-cover",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface CardMediaProps
  extends React.ComponentProps<typeof ark.div>,
    VariantProps<typeof cardMediaVariants> {}

export const CardMedia = (props: CardMediaProps) => {
  const { variant = "default", className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(cardMediaVariants({ variant }), className)}
      data-variant={variant}
      {...rest}
      data-slot={slot ?? "card-media"}
    />
  );
};

interface HeaderProps extends React.ComponentProps<typeof ark.div> {
  /**
   * The description of the card
   */
  description?: string;
  /**
   * The title of the card
   */
  title?: string;
}

export const CardHeader = (props: HeaderProps) => {
  const { title, description, className, children, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] gap-1",
        "px-(--space)",
        "items-start",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...rest}
      data-slot={slot ?? "card-header"}
    >
      {!!title && <CardTitle>{title}</CardTitle>}
      {!!description && <CardDescription>{description}</CardDescription>}
      {!title && typeof children === "string" ? (
        <CardTitle>{children}</CardTitle>
      ) : (
        children
      )}
    </ark.div>
  );
};

// A real heading (h3) so cards contribute to the document outline; the visual size is set by
// the class, and `asChild` lets a consumer pick another level where the hierarchy needs it.
export const CardTitle = (props: React.ComponentProps<typeof ark.h3>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.h3
      className={cn(
        "font-heading font-semibold text-foreground text-lg/6",
        className
      )}
      {...rest}
      data-slot={slot ?? "card-title"}
    />
  );
};

export const CardDescription = (
  props: React.ComponentProps<typeof ark.div>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("row-start-2", "text-muted-foreground text-sm", className)}
      {...rest}
      data-slot={slot ?? "card-description"}
    />
  );
};

export const CardAction = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...rest}
      data-slot={slot ?? "card-action"}
    />
  );
};

export const CardContent = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("px-(--space)", className)}
      {...rest}
      data-slot={slot ?? "card-content"}
    />
  );
};

export const CardFooter = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "flex items-center gap-2",
        "px-(--space)",
        "bg-muted/48",
        "rounded-b-xl border-t",
        "py-(--space)",
        className
      )}
      {...rest}
      data-slot={slot ?? "card-footer"}
    />
  );
};
