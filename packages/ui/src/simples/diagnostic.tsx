"use client";

// A machine's complaint, shown: a severity, a message, and the positions it points at. A SHACL
// violation, an LSP diagnostic and a stack trace are the same three things, so the vocabulary is
// theirs and the domain is nobody's. Client, because `DiagnosticFrame` hands `onSelect` to a real
// `onClick` — a function prop a Server Component may not pass.

import { ark } from "@ark-ui/react/factory";
import { ArrowUpRightIcon, CircleAlertIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "./collapsible";

/**
 * **`variant`, and the families are the house's.**
 *
 * It was `severity`, with `error | warning | info`. Both halves were a second vocabulary for
 * something the library already says: `Alert`, `Badge`, `Status` and `Button` all colour by
 * `variant`, and the family that means *this went wrong* is `destructive` everywhere else — the
 * word `error` appears in no other recipe here and in none of the reference's. A diagnostic is a
 * severity in the domain sense and a variant in the surface sense, and this is the surface.
 */
type Variant = "destructive" | "warning" | "info";

const VARIANT_ICON: Record<Variant, typeof InfoIcon> = {
  destructive: CircleAlertIcon,
  warning: TriangleAlertIcon,
  info: InfoIcon,
};

/**
 * The variant, for the two parts CSS cannot carry: the icon, which is a React element no selector
 * can produce, and the `Badge` the header wears, which takes it as a prop. Declared once on the
 * root and read here — not a second source of truth, which is why `DiagnosticSeverity` still takes
 * no variant of its own.
 */
const VariantContext = React.createContext<Variant>("destructive");

// A real `<ul>` rather than a div wearing `role="list"`: an implicit role belongs to the element
// and no merge can hand it away, which is the trap `Item` documents seen from the other side.
//
// **And an explicit `role="list"` on top of it, because `list-none` takes the implicit one away.**
// WebKit drops list semantics from a `<ul>` whose `list-style` is `none` — the whole list, items
// included — so a styled list announces nothing in VoiceOver while `<ul>`/`<li>` sit right there in
// the DOM. jsdom does not model that, so `getByRole("listitem")` passed the entire time. The
// element stays a `<ul>`; the role is the belt.
export const DiagnosticList = (props: React.ComponentProps<typeof ark.ul>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.ul
      className={cn("flex w-full list-none flex-col gap-1.5", className)}
      role="list"
      {...rest}
      data-slot={slot ?? "diagnostic-list"}
    />
  );
};

const diagnosticVariants = tv({
  base: [
    "group/diagnostic",
    "w-full",
    "rounded-xl border",
    "text-card-foreground text-sm",
  ],
  variants: {
    /**
     * **The reference's surface, not a coloured rail.**
     *
     * This used to be `border-s-2` in the family's colour over a neutral `bg-foreground/14` — a card with
     * a bar down one edge, which is a shape that appears nowhere in Shark UI and nowhere else in
     * this library. It is the generic callout, and it is what made a diagnostic read as machine
     * furniture rather than as one of these components.
     *
     * `Alert` is the surface a message with a severity has here, and these are its exact steps:
     * the wash at `-a3`, the whole outline at `-a6`, the glyph at the family. It stacks — the
     * reference stacks alerts, and the argument that six of them would read as decoration was made
     * about the rail, not about this.
     */
    variant: {
      destructive: ["bg-destructive/7", "border-destructive/30"],
      warning: ["bg-warning/7", "border-warning/30"],
      info: ["bg-info/7", "border-info/30"],
    },
  },
  defaultVariants: {
    variant: "destructive",
  },
});

// `asChild` is consumed here — the element is the `<li>` — so it is not a prop a caller may pass.
export interface DiagnosticProps
  extends Omit<React.ComponentProps<typeof Collapsible>, "asChild">,
    VariantProps<typeof diagnosticVariants> {}

/**
 * One diagnostic, collapsed to its header until it is opened. Open state, animation and the
 * trigger/content ARIA come from Ark's Collapsible, so `defaultOpen`, `open` and `onOpenChange`
 * pass through unchanged — the machine's root is handed to the `<li>` through `asChild`, which is
 * how a diagnostic is a real item of `DiagnosticList`'s `<ul>` and a collapsible at the same time.
 *
 * `variant` is written once, here. Repeating it as a prop on the badge is how the two drift.
 */
export const Diagnostic = (props: DiagnosticProps) => {
  const { variant = "destructive", className, children, slot, ...rest } = props;

  return (
    <VariantContext.Provider value={variant}>
      <Collapsible {...rest} asChild>
        <ark.li
          className={cn(diagnosticVariants({ variant }), className)}
          data-slot={slot ?? "diagnostic"}
          data-variant={variant}
        >
          {children}
        </ark.li>
      </Collapsible>
    </VariantContext.Provider>
  );
};

/**
 * One line **until the caller says otherwise**, and it was `flex-nowrap` — which is not the same
 * thing and cost the message.
 *
 * The argument for nowrap was real: a header that wraps turns a list of six into six different
 * shapes, and the message that overflows is the one `DiagnosticDescription` repeats in full once the
 * row is open. What it did not survive is a narrow column. Measured on the `metadata-form` showcase,
 * whose findings panel is 24 % of the workspace: **a 143 px header, with the title 0 px wide and
 * starting at x=215** — 72 px past its own right edge. The severity, the source and the trigger are
 * all `shrink-0`, so they take the width and `DiagnosticTitle`'s `flex-1` shrinks to nothing. Not
 * truncated with an ellipsis: gone, and the row said only *This field is required.* three times over
 * with nothing to tell the three apart.
 *
 * `flex-wrap` changes nothing for a header that fits, and nothing for a wide list either: the title
 * is `basis-0`, so it never forces a break on its own. What it does is make `basis-full` on the
 * title mean what a reader would expect — *this goes on its own line* — which is what the showcase
 * had already written, with a comment claiming this component wrapped. It did not. Now it does, and
 * an item that cannot fit wraps instead of overflowing the box.
 */
export const DiagnosticHeader = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("flex w-full min-w-0 flex-wrap items-center gap-2 px-3 py-2", className)}
      {...rest}
      data-slot={slot ?? "diagnostic-header"}
    />
  );
};

/**
 * The severity, as an icon and whatever word the call site gives it. The icon comes from the root
 * and is not the caller's to pass; the text is.
 *
 * **It is a `Badge`**, and it used to be a `Badge` respelled: `h-5 min-w-5 px-1.5 rounded-md
 * font-medium text-xs` beside three `group-data-[severity=…]` lines that repainted, by hand, the
 * three soft variants `Badge` already ships. `Tool`'s state chip has always used the real one.
 * Nothing is lost by the swap — the size is `Badge`'s `sm`, the fills are the same tokens — and the
 * three selector lines go with it.
 */
export const DiagnosticSeverity = (props: React.ComponentProps<typeof Badge>) => {
  const { className, children, slot, ...rest } = props;
  const variant = React.useContext(VariantContext);
  const Icon = VARIANT_ICON[variant];

  return (
    <Badge
      className={cn("shrink-0", className)}
      size="sm"
      variant={variant}
      {...rest}
      slot={slot ?? "diagnostic-severity"}
    >
      <Icon aria-hidden="true" />
      {children}
    </Badge>
  );
};

export const DiagnosticTitle = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "min-w-0 flex-1 truncate font-medium text-sm leading-snug",
        // Opening a row is the one moment the whole message is worth more than the alignment.
        "group-data-[state=open]/diagnostic:whitespace-normal",
        className
      )}
      {...rest}
      data-slot={slot ?? "diagnostic-title"}
    />
  );
};

// What produced the diagnostic — a shape name, a rule id. Monospace because it is an identifier
// somebody has to type back into a tool, not prose.
export const DiagnosticSource = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.span
      className={cn(
        "shrink-0 whitespace-nowrap font-mono text-muted-foreground text-xs max-sm:hidden",
        className
      )}
      {...rest}
      data-slot={slot ?? "diagnostic-source"}
    />
  );
};

export const DiagnosticActions = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.div
      className={cn("flex shrink-0 items-center gap-1", className)}
      {...rest}
      data-slot={slot ?? "diagnostic-actions"}
    />
  );
};

export const DiagnosticTrigger = (props: React.ComponentProps<typeof CollapsibleTrigger>) => {
  const { className, children, slot, ...rest } = props;

  return (
    <CollapsibleTrigger
      className={cn(
        "inline-flex items-center justify-center gap-1",
        // WCAG 2.5.8 asks 24×24 CSS pixels, and every `rem` here is measured against a root the
        // density axis sets — 14px at compact, where `min-h-6` would be 21. `DiagnosticFrame`'s
        // floor is the same number for the same reason.
        "min-h-[24px] min-w-[24px] px-2",
        "rounded-md font-medium text-muted-foreground text-xs tabular-nums",
        "hover:bg-accent hover:text-accent-foreground",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
        "[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:shrink-0",
        className
      )}
      {...rest}
      slot={slot ?? "diagnostic-trigger"}
    >
      {children}
      <CollapsibleIndicator />
    </CollapsibleTrigger>
  );
};

export const DiagnosticContent = (props: React.ComponentProps<typeof CollapsibleContent>) => {
  const { className, slot, ...rest } = props;

  return (
    <CollapsibleContent
      className={cn("flex flex-col gap-2 border-t px-3 pt-2.5 pb-2.5", className)}
      {...rest}
      slot={slot ?? "diagnostic-content"}
    />
  );
};

export const DiagnosticDescription = (props: React.ComponentProps<typeof ark.p>) => {
  const { className, slot, ...rest } = props;

  return (
    <ark.p
      className={cn("text-muted-foreground text-sm leading-normal", className)}
      {...rest}
      data-slot={slot ?? "diagnostic-description"}
    />
  );
};

// Not a list, deliberately, and `DiagnosticList`'s `<ul>` is the contrast: a frame is a `<button>`
// whenever it can be pressed, so it can be neither an `<li>` nor a `role="listitem"` without losing
// the role it already has — the trap `Item` documents.
export const DiagnosticFrames = (props: React.ComponentProps<typeof ark.div>) => {
  const { className, slot, ...rest } = props;

  return (
    // Pulled out by the frame's own padding, so a frame's text lines up with the description above
    // it and its hover fill is a full-width row rather than an inset one.
    <ark.div
      className={cn("-ms-2 -me-2 flex flex-col", className)}
      {...rest}
      data-slot={slot ?? "diagnostic-frames"}
    />
  );
};

const diagnosticFrameVariants = tv({
  base: [
    "flex w-full items-center gap-1.5",
    "min-h-[24px] rounded-md px-2 py-1",
    "text-start font-mono text-xs",
    "[&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[button&]:cursor-pointer [button&]:hover:bg-accent [button&]:hover:text-accent-foreground",
    "[button&]:outline-none [button&]:focus-visible:ring-[3px] [button&]:focus-visible:ring-ring",
  ],
  variants: {
    // Two channels, so the distinction survives a reader who is scanning rather than reading: the
    // row drops a tier, and the file loses the weight that marks an authored position.
    //
    // The tier is `--muted-foreground` and not `--faint`, which is what a dimmed thing usually
    // reaches for here: `--faint` is solved against the page, and a diagnostic is a wash over it.
    // Measured 2026-08 over the six documents in `packages/theme/palettes`, both modes: faint on
    // that surface is 3.96–6.62:1 and lands under WCAG AA's 4.5 in seven of the twelve;
    // muted-foreground is 6.54–9.48 in all of them. Every dimmed part below reads the same way.
    //
    // **Those numbers were taken against `bg-foreground/14`, and the card is now `bg-destructive/7` /
    // `-warning-a3` / `-info-a3`** — the surface moved with the `Alert` alignment. The direction
    // is not in doubt (a family wash at `-a3` is a comparably light tint, and the gap between the
    // two tiers is ~2.5 stops), but the figures no longer describe what is painted. Re-measuring
    // over the three washes on both modes is owed, and until it happens this is a claim about a
    // surface that has been replaced.
    secondary: {
      true: ["text-muted-foreground", "[&_[data-slot=diagnostic-frame-file]]:font-normal"],
      false: "text-foreground",
    },
  },
  defaultVariants: {
    secondary: false,
  },
});

export interface DiagnosticFrameProps
  extends Omit<React.ComponentProps<typeof ark.button>, "onSelect" | "children"> {
  /** The file, graph or node the position is in. */
  path: string;
  line?: number;
  column?: number;
  /** A short note beside the position — the property path, the frame's function. */
  label?: string;
  /**
   * An inferred or upstream position rather than one the author wrote — the counterpart of a
   * `node_modules` frame. Dimmed, never hidden: it is usually the frame that explains the others.
   */
  secondary?: boolean;
  onSelect?: () => void;
}

/**
 * One position, read as a location rather than a string: the directory recedes, the file carries
 * the weight, and the line and column are tabular so a column of frames lines up.
 *
 * With `onSelect` it is a real `<button>` wearing the arrow that says it goes somewhere; without
 * one it is static text, because a control that does nothing is announced as a control and answers
 * to nothing.
 */
export const DiagnosticFrame = (props: DiagnosticFrameProps) => {
  const { path, line, column, label, secondary = false, onSelect, className, slot, ...rest } = props;

  const cut = path.lastIndexOf("/") + 1;
  const directory = path.slice(0, cut);
  const file = path.slice(cut);
  const position =
    line === undefined ? "" : column === undefined ? `:${line}` : `:${line}:${column}`;

  const body = (
    <>
      <ark.span className="flex min-w-0 items-baseline">
        {directory ? (
          <ark.span className="truncate text-muted-foreground" data-slot="diagnostic-frame-directory">
            {directory}
          </ark.span>
        ) : null}
        <ark.span className="shrink-0 font-medium" data-slot="diagnostic-frame-file">
          {file}
        </ark.span>
        {position ? (
          <ark.span
            className="shrink-0 text-muted-foreground tabular-nums"
            data-slot="diagnostic-frame-position"
          >
            {position}
          </ark.span>
        ) : null}
      </ark.span>
      {label || onSelect ? (
        <ark.span className="ms-auto flex shrink-0 items-center gap-1.5 font-sans text-muted-foreground">
          {label ? <ark.span data-slot="diagnostic-frame-label">{label}</ark.span> : null}
          {onSelect ? <ArrowUpRightIcon aria-hidden="true" /> : null}
        </ark.span>
      ) : null}
    </>
  );

  const shared = {
    className: cn(diagnosticFrameVariants({ secondary }), className),
    "data-secondary": secondary ? "" : undefined,
  };

  if (onSelect) {
    return (
      // Ark ships no equivalent, so the ARIA contract is ours: the button is named by the position
      // and its label joined with a dash. Without it the name is the spans run together —
      // "ledgerQ-1058:12:7as claimed" — because the rhythm that separates them is visual only.
      <ark.button
        aria-label={label ? `${path}${position} — ${label}` : `${path}${position}`}
        onClick={onSelect}
        type="button"
        {...shared}
        {...rest}
        data-slot={slot ?? "diagnostic-frame"}
      >
        {body}
      </ark.button>
    );
  }

  return (
    // One props type cannot describe two elements, and `ref` is the member that conflicts: which
    // element this is depends on `onSelect`, which the type system sees no earlier than we do.
    <ark.span
      {...shared}
      {...(rest as React.ComponentProps<typeof ark.span>)}
      data-slot={slot ?? "diagnostic-frame"}
    >
      {body}
    </ark.span>
  );
};
