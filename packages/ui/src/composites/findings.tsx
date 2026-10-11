"use client";

// What a check found, drawn: an item for one result or for many that share a rule, a group of items
// under a heading, a header that says what was checked, and a badge that tallies them and opens onto
// the list. The model is `lib/findings.ts`; the place a finding points at is the host's, and reaches
// an item only through `describe`, so this file knows no RDF and no LSP. `/docs/design/findings` is
// the argument.

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn } from "../lib/cn.js";
import {
  type FindingGroup,
  type Finding,
  type FindingSeverity,
  type FindingTally,
  worstOf,
} from "../lib/findings.js";
import { Badge } from "../simples/badge.js";
import { Button } from "../simples/button.js";
import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticHeader,
  DiagnosticList,
  type DiagnosticProps,
  DiagnosticSeverity,
  DiagnosticTitle,
  DiagnosticTrigger,
} from "../simples/diagnostic.js";
import { useLocale } from "../simples/locale.js";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  usePopover,
} from "../simples/popover.js";
import { ScrollArea } from "../simples/scroll-area.js";
import { Toggle } from "../simples/toggle.js";

/** A severity is a domain word; the surface's families are `Diagnostic`'s. */
const VARIANT = {
  violation: "destructive",
  warning: "warning",
  info: "info",
} as const satisfies Record<FindingSeverity, string>;

/**
 * The one thing to do about an item or a group — *Go to field*, *Go to line*, *Show 362* — in the
 * host's words. With `pressed` it is a toggle, Ark's: *Show* puts something on the page and pressing
 * it again takes it off, so the button says which is true now.
 */
export interface FindingAction {
  label: string;
  run: () => void;
  pressed?: boolean;
}

/** A place, as a reader sees it: where it is, and what opening its item shows. */
export interface FindingPlace {
  /** *totalCost · Project/123*, *Line 12*. Wraps: a long IRI breaks anywhere rather than widening the item. */
  where: React.ReactNode;
  /** Shown when the item is opened — the offending value, say. */
  detail?: React.ReactNode;
}

/** The host's reading of its own place. The only door a place has into this file. */
export type DescribePlace<Place> = (place: Place) => FindingPlace;

/** The words the parts draw that are not the host's data. English until a host says otherwise. */
export interface FindingLabels {
  /** The header's title. */
  title: string;
  severity: Record<FindingSeverity, string>;
  /** The accessible name of an item's disclosure, before its place when the place is text. */
  details: string;
}

const LABELS: FindingLabels = {
  title: "Findings",
  severity: { violation: "Violation", warning: "Warning", info: "Info" },
  details: "Details",
};

interface FindingsContextValue {
  /** `undefined` until something was checked. */
  tally: FindingTally | undefined;
  worst: FindingSeverity | undefined;
  labels: FindingLabels;
}

const FindingsContext = React.createContext<FindingsContextValue | null>(null);

/** Closes the popover an action sits in, before the action moves focus elsewhere. */
const CloseContext = React.createContext<(() => void) | undefined>(undefined);

/** The tally and the words, for a part of the caller's own. Only inside `FindingsRoot`. */
export const useFindings = () => {
  const context = React.useContext(FindingsContext);
  if (!context) throw new Error("useFindings must be used inside FindingsRoot");
  return context;
};

const useLabels = (own: Partial<FindingLabels> | undefined): FindingLabels => {
  const inherited = React.useContext(FindingsContext)?.labels ?? LABELS;
  return own ? { ...inherited, ...own } : inherited;
};

const useCount = () => {
  const { locale } = useLocale();
  return React.useMemo(() => new Intl.NumberFormat(locale), [locale]);
};

const nameOf = (labels: FindingLabels, where: React.ReactNode) =>
  typeof where === "string" ? `${labels.details}: ${where}` : labels.details;

/** A label a reader may have to type back into a tool — a path, a file — that wraps anywhere. */
const MONO = "min-w-0 flex-1 font-mono text-muted-foreground text-xs wrap-anywhere";

// ── The action ──────────────────────────────────────────────────────────────────────────────────

/**
 * An item's or a group's one action: a `Button`, or Ark's `Toggle` when it is `pressed` or not.
 * Inside a findings popover it closes the popover first, so focus lands where the action sends it.
 */
const Action = ({ action }: { action: FindingAction }) => {
  const close = React.useContext(CloseContext);
  const run = () => {
    close?.();
    action.run();
  };
  if (action.pressed !== undefined)
    return (
      <Toggle
        className="shrink-0"
        onPressedChange={run}
        pressed={action.pressed}
        size="sm"
        slot="findings-action"
        variant="outline"
      >
        {action.label}
      </Toggle>
    );
  return (
    <Button onClick={run} size="sm" slot="findings-action" variant="outline">
      {action.label}
    </Button>
  );
};

/**
 * The end of a line, where its controls sit: a group's action, the header's buttons — the place an
 * item's action and disclosure hold on its line. `DiagnosticActions`, pushed to the end.
 */
export const FindingsActions = (props: React.ComponentProps<typeof DiagnosticActions>) => {
  const { className, slot, ...rest } = props;
  return <DiagnosticActions className={cn("ms-auto", className)} {...rest} slot={slot ?? "findings-actions"} />;
};

// ── The item ────────────────────────────────────────────────────────────────────────────────────

/** Where, as a part: the one cell of line 1 that grows, and it wraps — anywhere, for an IRI. */
const Where = ({ children }: { children: React.ReactNode }) => (
  <ark.span className={MONO} data-slot="findings-where">
    {children}
  </ark.span>
);

/**
 * Line 2: the message, on its own line, wrapping. `DiagnosticTitle` truncates to keep a collapsed
 * list one shape, and that is right for a title beside other things; a message given a line of its
 * own has nothing to align with, and cutting it is losing it.
 */
const Message = ({ children }: { children: React.ReactNode }) => (
  <DiagnosticTitle className="basis-full wrap-break-word whitespace-normal!" slot="findings-message">
    {children}
  </DiagnosticTitle>
);

/** What the host's place shows when its item is opened. */
const Detail = ({ children }: { children: React.ReactNode }) => (
  // A `div`, not `DiagnosticDescription`'s `<p>`: a host's detail may hold frames or a list.
  <ark.div className="text-muted-foreground text-sm leading-normal wrap-anywhere" data-slot="findings-detail">
    {children}
  </ark.div>
);

const Rule = ({ rule }: { rule: Finding["rule"] }) => (
  <ark.p className="font-mono text-muted-foreground text-xs wrap-anywhere" data-slot="findings-rule">
    {rule.label}
    {rule.id !== rule.label ? <ark.span className="opacity-70"> · {rule.id}</ark.span> : null}
  </ark.p>
);

export interface FindingsItemProps<Place>
  extends Omit<DiagnosticProps, "variant" | "children"> {
  /** One result, or many that share a rule. */
  finding: Finding<Place> | FindingGroup<Place>;
  /** How a place reads: one result's on line 1, a group's sampled places once it is opened. */
  describe: DescribePlace<Place>;
  /** The item's one action — *Go to field*, *Show 362*. A group's places are read, not acted on. */
  action?: FindingAction;
  labels?: Partial<FindingLabels>;
  /**
   * Line 1's place, when it is not what `describe` reads — what a group shares, *totalCost*. Without
   * it, one result's place as `describe` reads it, and a group's rule label.
   */
  children?: React.ReactNode;
}

const isGroup = <Place,>(finding: Finding<Place> | FindingGroup<Place>): finding is FindingGroup<Place> =>
  "count" in finding;

/**
 * **One result, or many that share a rule.** Line 1 is the severity — with the count, for a group —
 * where and the one action; line 2 the message, wrapping. Opening it shows one result's detail, or a
 * group's sample, each place where it is and what it holds; then the rule and the help. Nothing is
 * held to one line but the severity badge and the buttons — the shape a compiler prints, and the only
 * one that survives a narrow column. A group of 17,000 is one item, not 17,000.
 */
export function FindingsItem<Place>(props: FindingsItemProps<Place>) {
  const { finding, describe, action, labels: own, children, slot, ...rest } = props;
  const labels = useLabels(own);
  const count = useCount();
  const group = isGroup(finding) ? finding : undefined;
  const one = group ? undefined : describe((finding as Finding<Place>).place);
  const where = children ?? one?.where ?? finding.rule.label;
  const help = group ? group.sample[0]?.help : (finding as Finding<Place>).help;

  return (
    <Diagnostic
      data-count={group?.count}
      data-severity={finding.severity}
      slot={slot ?? "findings-item"}
      variant={VARIANT[finding.severity]}
      {...rest}
    >
      <DiagnosticHeader>
        <DiagnosticSeverity>
          {labels.severity[finding.severity]}
          {group ? (
            <ark.span className="tabular-nums" data-slot="findings-count">
              {count.format(group.count)}
            </ark.span>
          ) : null}
        </DiagnosticSeverity>
        <Where>{where}</Where>
        <DiagnosticActions className="ms-auto">
          {action ? <Action action={action} /> : null}
          <DiagnosticTrigger aria-label={nameOf(labels, where)} />
        </DiagnosticActions>
        <Message>{finding.message}</Message>
      </DiagnosticHeader>
      <DiagnosticContent>
        {one?.detail ? <Detail>{one.detail}</Detail> : null}
        {group ? (
          <ark.ul className="flex list-none flex-col gap-2" data-slot="findings-sample" role="list">
            {group.sample.map((sampled, i) => {
              const place = describe(sampled.place);
              return (
                <ark.li className="flex min-w-0 flex-col gap-0.5" key={i}>
                  <Where>{place.where}</Where>
                  {sampled.message !== group.message ? (
                    <ark.span className="text-muted-foreground text-xs wrap-break-word">{sampled.message}</ark.span>
                  ) : null}
                  {place.detail ? <Detail>{place.detail}</Detail> : null}
                </ark.li>
              );
            })}
          </ark.ul>
        ) : null}
        <Rule rule={finding.rule} />
        {help ? <DiagnosticDescription>{help}</DiagnosticDescription> : null}
      </DiagnosticContent>
    </Diagnostic>
  );
}

// ── The tally ───────────────────────────────────────────────────────────────────────────────────

export interface FindingsTallyProps extends React.ComponentProps<typeof ark.span> {
  tally: FindingTally;
  labels?: Partial<FindingLabels>;
}

/**
 * A count per severity present, each a small badge in its family with the severity's word for a
 * screen reader — *Violation 12, Warning 3*. What a group's heading carries, rather than the list of
 * paths it holds.
 */
export const FindingsTally = (props: FindingsTallyProps) => {
  const { tally, labels: own, className, slot, ...rest } = props;
  const labels = useLabels(own);
  const count = useCount();

  return (
    <ark.span
      className={cn("inline-flex flex-wrap items-center gap-1", className)}
      {...rest}
      data-slot={slot ?? "findings-tally"}
    >
      {(["violation", "warning", "info"] as const)
        .filter((severity) => tally[severity] > 0)
        .map((severity) => (
          <Badge
            className="tabular-nums"
            data-severity={severity}
            key={severity}
            size="xs"
            variant={VARIANT[severity]}
          >
            <ark.span className="sr-only">{labels.severity[severity]} </ark.span>
            {count.format(tally[severity])}
          </Badge>
        ))}
    </ark.span>
  );
};

export interface FindingsGroupProps
  extends Omit<React.ComponentProps<typeof ark.section>, "title"> {
  /** What the items share — a shape, a file. Names the region. */
  title: React.ReactNode;
  tally: FindingTally;
  /** One action over every item — *Show 44* — at the end of the heading, as an item's is at the end of its line. */
  action?: FindingAction;
  labels?: Partial<FindingLabels>;
}

/**
 * Items under a heading — a `<section>` named by its `<h3>`, so a screen reader moves between them —
 * with the heading's tally beside it and not in its name: the region is *ProjectShape*, and the
 * counts are what it holds. The items are the caller's, `FindingsItem` or anything built on
 * `Diagnostic`.
 */
export const FindingsGroup = (props: FindingsGroupProps) => {
  const { title, tally, action, labels, children, className, slot, ...rest } = props;
  const heading = React.useId();

  return (
    <ark.section
      aria-labelledby={heading}
      className={cn("flex flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "findings-group"}
    >
      <ark.div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ark.h3
          className="min-w-0 font-medium text-muted-foreground text-xs wrap-anywhere"
          id={heading}
        >
          {title}
        </ark.h3>
        <FindingsTally labels={labels} tally={tally} />
        {action ? (
          <FindingsActions>
            <Action action={action} />
          </FindingsActions>
        ) : null}
      </ark.div>
      <DiagnosticList>{children}</DiagnosticList>
    </ark.section>
  );
};

// ── The badge and its popover ───────────────────────────────────────────────────────────────────

export interface FindingsRootProps extends React.ComponentProps<typeof Popover> {
  /** What was found. `undefined` is *nothing checked yet* — no rules, or no run — and is not *clean*. */
  tally: FindingTally | undefined;
  labels?: Partial<FindingLabels>;
}

/**
 * Ark's `Popover`, holding the tally. `open`, `defaultOpen` and `onOpenChange` are the machine's —
 * a host that opens the list from elsewhere (a blocked submit) controls it like any popover. It
 * opens in every state: with nothing checked or nothing found, the popover is where a host says why
 * and offers the way on.
 */
export function FindingsRoot(props: FindingsRootProps) {
  const { tally, labels, positioning, ...rest } = props;

  const value = React.useMemo<FindingsContextValue>(
    () => ({
      tally,
      worst: tally ? worstOf(tally) : undefined,
      labels: labels ? { ...LABELS, ...labels } : LABELS,
    }),
    [tally, labels],
  );

  return (
    <FindingsContext.Provider value={value}>
      <Popover positioning={{ placement: "bottom-end", ...positioning }} {...rest} />
    </FindingsContext.Provider>
  );
}

export interface FindingsBadgeProps
  extends Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> {
  /**
   * The tally in the host's words — *362 violations · 17,364 warnings*, *Valid*, *No rules* — and
   * so the button's accessible name. Required: a count alone names nothing, and a plural rule is a
   * locale's.
   */
  children: React.ReactNode | ((tally: FindingTally | undefined) => React.ReactNode);
}

/**
 * **The entry**: a `Badge` that is the popover's trigger, painted by the worst finding — `success`
 * when the check found nothing, `outline` when nothing was checked. Always a button, because the
 * popover always has something to say.
 */
export const FindingsBadge = (props: FindingsBadgeProps) => {
  const { children, className, slot, ...rest } = props;
  const { tally, worst } = useFindings();
  const label = typeof children === "function" ? children(tally) : children;
  const variant = !tally ? "outline" : worst ? VARIANT[worst] : "success";

  return (
    <PopoverTrigger asChild>
      <Badge
        asChild
        className={cn("tabular-nums", className)}
        data-checked={tally ? "" : undefined}
        variant={variant}
        {...rest}
        slot={slot ?? "findings-badge"}
      >
        <ark.button type="button">{label}</ark.button>
      </Badge>
    </PopoverTrigger>
  );
};

/**
 * The popover, and the width it holds: `FindingsHeader` above, `FindingsList` below. **A fixed
 * width**, because Ark's content is `min-width: fit-content` and one unbroken line would set it.
 */
export const FindingsContent = (props: React.ComponentProps<typeof PopoverContent>) => {
  const { children, className, slot, ...rest } = props;
  const popover = usePopover();
  const close = React.useCallback(() => popover.setOpen(false), [popover]);

  return (
    <PopoverContent
      className={cn("max-h-[min(32rem,70vh)] w-[min(28rem,calc(100vw-2rem))]", className)}
      {...rest}
      slot={slot ?? "findings-content"}
    >
      <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
    </PopoverContent>
  );
};

/**
 * **The header**: the title, then what was checked and the controls on line 1, then what the check
 * covered on a line of its own — the item's two lines, at the top of the popover:
 *
 * ```tsx
 * <FindingsHeader>
 *   <FindingsSource>flights-shapes.ttl · 4 rules</FindingsSource>
 *   <FindingsActions>…</FindingsActions>
 *   <PopoverDescription>1,204 of 3,310 nodes checked · 1,199 conform</PopoverDescription>
 * </FindingsHeader>
 * ```
 *
 * `PopoverHeader`, laid out as a row that wraps. The title is the labels' — *Findings* — and is
 * Ark's `Popover.Title`, so it names the dialog; the scope is `PopoverDescription`, Ark's too, and
 * describes it. Above the list and not scrolling with it.
 */
export const FindingsHeader = (props: React.ComponentProps<typeof PopoverHeader>) => {
  const { children, className, slot, ...rest } = props;
  const { title } = useLabels(undefined);

  return (
    <PopoverHeader
      className={cn(
        "flex-row flex-wrap items-center gap-x-2 gap-y-1",
        "*:data-[slot=popover-description]:basis-full",
        className,
      )}
      {...rest}
      slot={slot ?? "findings-header"}
    >
      <PopoverTitle className="shrink-0">{title}</PopoverTitle>
      {children}
    </PopoverHeader>
  );
};

/** What was checked — a file, a form — beside the title: muted, monospace, and it wraps. */
export const FindingsSource = (props: React.ComponentProps<typeof ark.span>) => {
  const { className, slot, ...rest } = props;
  return <ark.span className={cn(MONO, className)} {...rest} data-slot={slot ?? "findings-source"} />;
};

export interface FindingsListProps extends React.ComponentProps<typeof ark.div> {
  /**
   * Drawn instead of the children when nothing was found, or nothing checked — the list's fallback,
   * as `Show`'s is, and not a region beside it.
   */
  empty?: React.ReactNode;
}

/**
 * The list — or `empty` — in a vertical-only `ScrollArea`. **A vertical area**: Ark's content is
 * `min-width: fit-content` on both axes, so one unbroken line would set the popover's width; see
 * `ScrollArea`'s `orientation`.
 */
export const FindingsList = (props: FindingsListProps) => {
  const { empty, children, className, slot, ...rest } = props;
  const { tally } = useFindings();
  const found = Boolean(tally && tally.total > 0);

  return (
    <ScrollArea className="flex min-h-0 flex-1 flex-col" orientation="vertical">
      <ark.div
        className={cn(
          "flex min-w-0 flex-col gap-4 p-(--space)",
          "in-[[data-slot=findings-content]:has([data-slot=findings-header])]:pt-1",
          className,
        )}
        {...rest}
        data-slot={slot ?? "findings-list"}
      >
        {found ? children : empty}
      </ark.div>
    </ScrollArea>
  );
};
