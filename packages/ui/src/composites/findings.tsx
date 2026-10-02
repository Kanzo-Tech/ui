"use client";

// What a check found, behind one badge: the tally on the trigger, the findings grouped worst first
// in a popover, and a way to each one's place. A compiler's problems and a form's violations are the
// same list, so the rows are the caller's — `Diagnostic`, or anything built on it — and this only
// counts, groups and goes.

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn } from "../lib/cn.js";
import { Badge } from "../simples/badge.js";
import { Button } from "../simples/button.js";
import { DiagnosticList } from "../simples/diagnostic.js";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  usePopover,
} from "../simples/popover.js";

/** `Diagnostic`'s families, so a finding's variant is the one its row already wears. */
export type FindingVariant = "destructive" | "warning" | "info";

/** What the list needs of a finding. Everything else on it is the caller's, and comes back typed. */
export interface Finding {
  id: string;
  variant: FindingVariant;
}

export type FindingCounts = Record<FindingVariant, number> & { total: number };

/** Worst first: the order of the groups and the variant the tally wears. */
const ORDER: readonly FindingVariant[] = ["destructive", "warning", "info"];

interface FindingsContextValue {
  findings: readonly Finding[];
  counts: FindingCounts;
  /** The worst variant present, or `undefined` when nothing was found. */
  worst: FindingVariant | undefined;
  onSelect: ((finding: Finding) => void) | undefined;
}

const FindingsContext = React.createContext<FindingsContextValue | null>(null);
const FindingContext = React.createContext<Finding | null>(null);

/** The tally and the list, for a part of the caller's own. Only inside `FindingsRoot`. */
export const useFindings = () => {
  const context = React.useContext(FindingsContext);
  if (!context) throw new Error("useFindings must be used inside FindingsRoot");
  return context;
};

/** The finding a row inside `FindingsGroup` is drawing. */
export const useFinding = <F extends Finding = Finding>() => {
  const finding = React.useContext(FindingContext);
  if (!finding) throw new Error("useFinding must be used inside FindingsGroup");
  return finding as F;
};

export interface FindingsRootProps<F extends Finding>
  extends React.ComponentProps<typeof Popover> {
  findings: readonly F[];
  /** Where `FindingsGoTo` sends the reader. The popover closes first, so focus can land there. */
  onSelect?: (finding: F) => void;
}

/**
 * Ark's `Popover`, holding the findings. `open`, `defaultOpen` and `onOpenChange` are the
 * machine's and pass straight through — a host that opens the list from elsewhere (a blocked
 * submit) controls it like any popover.
 */
export function FindingsRoot<F extends Finding>(props: FindingsRootProps<F>) {
  const { findings, onSelect, positioning, ...rest } = props;

  const value = React.useMemo<FindingsContextValue>(() => {
    const counts: FindingCounts = { destructive: 0, warning: 0, info: 0, total: findings.length };
    for (const finding of findings) counts[finding.variant] += 1;
    return {
      findings,
      counts,
      worst: ORDER.find((variant) => counts[variant] > 0),
      onSelect: onSelect as FindingsContextValue["onSelect"],
    };
  }, [findings, onSelect]);

  return (
    <FindingsContext.Provider value={value}>
      {/* Nothing found is nothing to list: the popover cannot be open over an empty list, and
          closes when the last finding is fixed under it. */}
      <Popover
        positioning={{ placement: "bottom-end", ...positioning }}
        {...rest}
        open={findings.length === 0 ? false : rest.open}
      />
    </FindingsContext.Provider>
  );
}

export interface FindingsTriggerProps
  extends Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> {
  /** The tally, in the caller's words. Without it, the count. */
  children?: React.ReactNode | ((counts: FindingCounts) => React.ReactNode);
}

/**
 * A `Badge` that is the popover's trigger, painted by the worst finding. The words are the
 * caller's, because "2 errors", "3 issues" and "Valid" are a product's vocabulary and a plural rule
 * is a locale's.
 *
 * **With nothing found it is a `success` badge and not a button**: there is no list to open, and a
 * control that opens nothing is announced as one and answers to nothing.
 */
export const FindingsTrigger = (props: FindingsTriggerProps) => {
  const { children, className, slot, ...rest } = props;
  const { counts, worst } = useFindings();
  const label = typeof children === "function" ? children(counts) : (children ?? counts.total);

  if (!worst) {
    return (
      <Badge
        className={cn("tabular-nums", className)}
        variant="success"
        {...rest}
        slot={slot ?? "findings-trigger"}
      >
        {label}
      </Badge>
    );
  }

  return (
    <PopoverTrigger asChild>
      <Badge
        asChild
        className={cn("tabular-nums", className)}
        variant={worst}
        {...rest}
        slot={slot ?? "findings-trigger"}
      >
        <ark.button type="button">{label}</ark.button>
      </Badge>
    </PopoverTrigger>
  );
};

export interface FindingsContentProps extends React.ComponentProps<typeof PopoverContent> {
  title?: string;
  description?: string;
}

/**
 * The popover: an optional header, then the groups, scrolling past a screen.
 *
 * **A fixed width, and a plain scrolling `div` rather than `PopoverBody`.** `PopoverBody` wraps Ark's
 * `ScrollArea`, whose content is `min-width: fit-content` — so a row's untruncated title set the
 * list's width, and the rows ran past a 448 px popover to 507 px behind a horizontal scrollbar
 * (measured 2026-10-02 on the docs example). A list of findings only ever scrolls down.
 */
export const FindingsContent = (props: FindingsContentProps) => {
  const { title, description, children, className, slot, ...rest } = props;
  const header = Boolean(title || description);

  return (
    <PopoverContent
      className={cn("max-h-[min(32rem,70vh)] w-[min(28rem,calc(100vw-2rem))]", className)}
      {...rest}
      slot={slot ?? "findings-content"}
    >
      {header ? <PopoverHeader className="pb-3" description={description} title={title} /> : null}
      <ark.div
        className={cn(
          "flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto overscroll-contain p-(--space)",
          header && "pt-1",
        )}
        data-slot="findings-list"
      >
        {children}
      </ark.div>
    </PopoverContent>
  );
};

export interface FindingsGroupProps<F extends Finding>
  extends Omit<React.ComponentProps<typeof ark.section>, "children"> {
  variant: FindingVariant;
  title: string;
  /** One row per finding of this variant, in the order the caller gave them. */
  children: (finding: F) => React.ReactNode;
}

/**
 * The findings of one variant, under a heading that counts them; nothing at all when there are
 * none. A `<section>` named by its `<h3>`, so a screen reader can jump between the groups. Each
 * row is drawn inside its finding's context, which is what `FindingsGoTo` reads.
 */
export function FindingsGroup<F extends Finding>(props: FindingsGroupProps<F>) {
  const { variant, title, children, className, slot, ...rest } = props;
  const { findings, counts } = useFindings();
  const heading = React.useId();

  if (counts[variant] === 0) return null;

  return (
    <ark.section
      aria-labelledby={heading}
      className={cn("flex flex-col gap-2", className)}
      data-variant={variant}
      {...rest}
      data-slot={slot ?? "findings-group"}
    >
      <ark.h3
        className="flex items-baseline gap-1.5 font-medium text-muted-foreground text-xs"
        id={heading}
      >
        {title}{" "}
        <ark.span className="tabular-nums">{counts[variant]}</ark.span>
      </ark.h3>
      <DiagnosticList>
        {findings
          .filter((finding) => finding.variant === variant)
          .map((finding) => (
            <FindingContext.Provider key={finding.id} value={finding}>
              {children(finding as F)}
            </FindingContext.Provider>
          ))}
      </DiagnosticList>
    </ark.section>
  );
}

/**
 * Sends the reader to the finding's place: closes the popover, then calls the root's `onSelect`
 * with the finding it sits in. Renders nothing without an `onSelect`, because a control that goes
 * nowhere is announced as one and answers to nothing.
 */
export const FindingsGoTo = (props: React.ComponentProps<typeof Button>) => {
  const { onClick, slot, ...rest } = props;
  const { onSelect } = useFindings();
  const finding = useFinding();
  const popover = usePopover();

  if (!onSelect) return null;

  return (
    <Button
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        popover.setOpen(false);
        onSelect(finding);
      }}
      size="sm"
      variant="ghost"
      {...rest}
      slot={slot ?? "findings-go-to"}
    />
  );
};
