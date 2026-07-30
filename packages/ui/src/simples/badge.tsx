import { ark } from "@ark-ui/react/factory";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";

const badgeVariants = tv({
  base: [
    "relative",
    "inline-flex items-center justify-center gap-1",
    "select-none whitespace-nowrap font-medium text-xs",
    "rounded-md border border-transparent",
    "overflow-hidden",
    "transition-colors",
    "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
    "[&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
    "[button&,a&]:cursor-pointer [button&,a&]:pointer-coarse:after:absolute [button&,a&]:pointer-coarse:after:size-full [button&,a&]:pointer-coarse:after:min-h-11 [button&,a&]:pointer-coarse:after:min-w-11",
    "motion-reduce:transition-none!",
  ],
  variants: {
    variant: {
      default: [
        "bg-foreground",
        "text-background",
        "focus-visible:border-foreground focus-visible:ring-foreground/20",
        "dark:focus-visible:ring-foreground/40",
        "[a&]:hover:bg-foreground/90",
      ],
      secondary: [
        "bg-secondary",
        "text-secondary-foreground",
        "border-secondary/20",
        "focus-visible:border-foreground focus-visible:ring-foreground/50",
        // Step 4's hover is step 5, and that is `--accent`. Diluting the fill composited it over
        // the page rather than over the badge: ΔE 0.61 from the rest state in light, 0.86 in dark.
        // `bg-accent` measures 3.96 and 4.61 — what the outline variant already uses.
        "[a&]:hover:bg-accent",
      ],
      outline: [
        "text-foreground",
        "border-border",
        "[a&]:hover:bg-accent",
        "[a&]:hover:text-accent-foreground",
      ],
      // The soft status badges read their ink off step 11 (`--X-foreground`), not off the step-9
      // fill. Measured on their own fill: `--success` 3.11:1 in light, `--warning` 2.75, `--info`
      // 3.56 in dark — step 9's obligation is `visible-fill` at 3:1, and a badge label is small
      // text that owes 4.5. Step 11 measures 5.17–6.81 on `--X-wash` and 4.86–6.28 on the
      // `-wash-strong` hover, across every surface a badge can sit on. This is what tokens.css
      // documents `-foreground` to be for a status family.
      //
      // The fills were `bg-X/10` → `bg-X/20`, and the destructive row carried the whole argument
      // for this change in one class: a 10% `bg-destructive` overridden to 5% in dark, a percentage
      // hand-corrected per mode because one number cannot serve both.
      success: [
        "bg-success-wash",
        "text-success-foreground",
        "border-success-border",
        "focus-visible:border-success focus-visible:ring-success/20",
        "[a&]:hover:bg-success-wash-strong",
      ],
      info: [
        "bg-info-wash",
        "text-info-foreground",
        "border-info-border",
        "focus-visible:border-info focus-visible:ring-info/50",
        "[a&]:hover:bg-info-wash-strong",
      ],
      warning: [
        "bg-warning-wash",
        "text-warning-foreground",
        "border-warning-border",
        "focus-visible:border-warning focus-visible:ring-warning/20",
        "dark:focus-visible:ring-warning/40",
        "[a&]:hover:bg-warning-wash-strong",
      ],
      destructive: [
        "bg-destructive-wash",
        "text-destructive-foreground",
        "border-destructive-border",
        "focus-visible:border-destructive focus-visible:ring-destructive/24",
        "dark:focus-visible:ring-destructive/40",
        "[a&]:hover:bg-destructive-wash-strong",
      ],
    },
    size: {
      // Micro-badge: the "Coming soon" / "Experimental" marker that sits next to a
      // control rather than standing on its own. Uses the smallest type token.
      xs: [
        "h-4 min-w-4",
        "px-1",
        "gap-0.5",
        "rounded-sm",
        "text-[length:var(--kanzo-font-size-xs)]",
        "[&_svg]:size-2.5",
      ],
      sm: ["h-5 min-w-5", "px-1"],
      md: ["h-5.5 min-w-5.5", "px-1.5"],
      lg: ["h-6.5 min-w-6.5", "px-2", "text-sm"],
    },
    pill: {
      true: [
        "rounded-full",
        "has-[>svg]:data-[size=xs]:pe-1.5",
        "has-[>svg]:data-[size=sm]:pe-1.5",
        "has-[>svg]:data-[size=md]:pe-2",
        "has-[>svg]:data-[size=lg]:pe-2 sm:has-[>svg]:data-[size=lg]:pe-2.5",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    pill: false,
  },
});

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

interface BadgeProps
  extends React.ComponentProps<typeof ark.span>,
    VariantProps<typeof badgeVariants> {}

export const Badge = (props: BadgeProps) => {
  const {
    variant = "default",
    size = "md",
    pill = false,
    className,
    slot,
    ...rest
  } = props;

  return (
    <ark.span
      className={cn(badgeVariants({ variant, size, pill }), className)}
      data-size={size}
      data-variant={variant}
      {...rest}
      data-slot={slot ?? "badge"}
    />
  );
};
