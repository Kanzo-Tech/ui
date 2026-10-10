"use client";

// What a check found, drawn: a row for one result, a row for many that share a rule, a group of
// rows under a heading, and a badge that tallies them and opens onto the list. The model is
// `lib/findings.ts`; the place a finding points at is the host's, and reaches a row only through
// `describe`, so this file knows no RDF and no LSP. `/docs/design/findings` is the argument.

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
import { Popover, PopoverContent, PopoverTrigger, usePopover } from "../simples/popover.js";
import { ScrollArea } from "../simples/scroll-area.js";

/** A severity is a domain word; the surface's families are `Diagnostic`'s. */
const VARIANT = {
  violation: "destructive",
  warning: "warning",
  info: "info",
} as const satisfies Record<FindingSeverity, string>;

/** Something to do at a place — *Show*, *Go to line* — in the host's words. */
export interface FindingAction {
  label: string;
  run: () => void;
}

/** A place, as a reader sees it: where it is, what to do there, and what else opening it shows. */
export interface FindingPlace {
  /** *totalCost · Project/123*, *Line 12*. Wraps: a long IRI breaks anywhere rather than widening the row. */
  where: React.ReactNode;
  action?: FindingAction;
  /** Shown when the row is opened — the offending value, say. */
  detail?: React.ReactNode;
}

/** The host's reading of its own place. The only door a place has into this file. */
export type DescribePlace<Place> = (place: Place) => FindingPlace;

/** The words the rows draw that are not the host's data. English until a host says otherwise. */
export interface FindingLabels {
  severity: Record<FindingSeverity, string>;
  /** The accessible name of a row's disclosure, before its place when the place is text. */
  details: string;
}

const LABELS: FindingLabels = {
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

/** Closes the popover a row sits in, before a place's action moves focus elsewhere. */
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

// ── Rows ────────────────────────────────────────────────────────────────────────────────────────

/** Where, as a part: the one cell of line 1 that grows, and it wraps — anywhere, for an IRI. */
const Where = ({ children }: { children: React.ReactNode }) => (
  <ark.span
    className="min-w-0 flex-1 font-mono text-muted-foreground text-xs wrap-anywhere"
    data-slot="finding-where"
  >
    {children}
  </ark.span>
);

const ActionButton = ({ action }: { action: FindingAction }) => {
  const close = React.useContext(CloseContext);
  return (
    <Button
      slot="finding-action"
      onClick={() => {
        close?.();
        action.run();
      }}
      size="sm"
      variant="outline"
    >
      {action.label}
    </Button>
  );
};

/**
 * Line 2: the message, on its own line, wrapping. `DiagnosticTitle` truncates to keep a collapsed
 * list one shape, and that is right for a title beside other things; a message given a line of its
 * own has nothing to align with, and cutting it is losing it.
 */
const Message = ({ children }: { children: React.ReactNode }) => (
  <DiagnosticTitle className="basis-full wrap-break-word whitespace-normal!" slot="finding-message">
    {children}
  </DiagnosticTitle>
);

const Rule = ({ rule }: { rule: Finding["rule"] }) => (
  <ark.p className="font-mono text-muted-foreground text-xs wrap-anywhere" data-slot="finding-rule">
    {rule.label}
    {rule.id !== rule.label ? <ark.span className="opacity-70"> · {rule.id}</ark.span> : null}
  </ark.p>
);

export interface FindingRowProps<Place>
  extends Omit<DiagnosticProps, "variant" | "children"> {
  finding: Finding<Place>;
  describe: DescribePlace<Place>;
  labels?: Partial<FindingLabels>;
}

/**
 * **One result.** Line 1 is the severity, where and the actions; line 2 the message, wrapping;
 * opening it shows the place's detail, the rule and the help. Nothing is held to one line but the
 * severity badge — the shape a compiler prints, and the only one that survives a narrow column.
 */
export function FindingRow<Place>(props: FindingRowProps<Place>) {
  const { finding, describe, labels: own, slot, ...rest } = props;
  const labels = useLabels(own);
  const { where, action, detail } = describe(finding.place);

  return (
    <Diagnostic
      data-severity={finding.severity}
      slot={slot ?? "finding-row"}
      variant={VARIANT[finding.severity]}
      {...rest}
    >
      <DiagnosticHeader>
        <DiagnosticSeverity>{labels.severity[finding.severity]}</DiagnosticSeverity>
        <Where>{where}</Where>
        <DiagnosticActions className="ms-auto">
          {action ? <ActionButton action={action} /> : null}
          <DiagnosticTrigger aria-label={nameOf(labels, where)} />
        </DiagnosticActions>
        <Message>{finding.message}</Message>
      </DiagnosticHeader>
      <DiagnosticContent>
        {detail ? (
          // A `div`, not `DiagnosticDescription`'s `<p>`: a host's detail may hold frames or a list.
          <ark.div
            className="text-muted-foreground text-sm leading-normal wrap-anywhere"
            data-slot="finding-detail"
          >
            {detail}
          </ark.div>
        ) : null}
        <Rule rule={finding.rule} />
        {finding.help ? <DiagnosticDescription>{finding.help}</DiagnosticDescription> : null}
      </DiagnosticContent>
    </Diagnostic>
  );
}

export interface FindingGroupRowProps<Place>
  extends Omit<DiagnosticProps, "variant" | "children"> {
  group: FindingGroup<Place>;
  /** How each sampled place reads, once the row is opened. */
  describe: DescribePlace<Place>;
  /** What the group shares — a path, *totalCost*. Without it, the rule's label. */
  where?: React.ReactNode;
  /** One action over every place — *Show 362* — which is the host's: it may filter, select, open. */
  action?: FindingAction;
  labels?: Partial<FindingLabels>;
}

/**
 * **Many results that share a rule.** The same two lines as `FindingRow`, with the count on the
 * severity badge and one action for all of them; opening it lists the sample, each place with its
 * own action, then the rule and the help. A group of 17,000 is one row, not 17,000.
 */
export function FindingGroupRow<Place>(props: FindingGroupRowProps<Place>) {
  const { group, describe, where, action, labels: own, slot, ...rest } = props;
  const labels = useLabels(own);
  const count = useCount();
  const shown = where ?? group.rule.label;

  return (
    <Diagnostic
      data-count={group.count}
      data-severity={group.severity}
      slot={slot ?? "finding-group-row"}
      variant={VARIANT[group.severity]}
      {...rest}
    >
      <DiagnosticHeader>
        <DiagnosticSeverity>
          {labels.severity[group.severity]}
          <ark.span className="tabular-nums" data-slot="finding-count">
            {count.format(group.count)}
          </ark.span>
        </DiagnosticSeverity>
        <Where>{shown}</Where>
        <DiagnosticActions className="ms-auto">
          {action ? <ActionButton action={action} /> : null}
          <DiagnosticTrigger aria-label={nameOf(labels, shown)} />
        </DiagnosticActions>
        <Message>{group.message}</Message>
      </DiagnosticHeader>
      <DiagnosticContent>
        <ark.ul className="flex list-none flex-col gap-1" data-slot="finding-sample" role="list">
          {group.sample.map((finding, i) => {
            const place = describe(finding.place);
            return (
              <ark.li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" key={i}>
                <Where>{place.where}</Where>
                {place.action ? <ActionButton action={place.action} /> : null}
                {finding.message !== group.message ? (
                  <ark.span className="basis-full text-muted-foreground text-xs wrap-break-word">
                    {finding.message}
                  </ark.span>
                ) : null}
              </ark.li>
            );
          })}
        </ark.ul>
        <Rule rule={group.rule} />
        {group.sample[0]?.help ? (
          <DiagnosticDescription>{group.sample[0].help}</DiagnosticDescription>
        ) : null}
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
  /** What the rows share — a shape, a file. Names the region. */
  title: React.ReactNode;
  tally: FindingTally;
  labels?: Partial<FindingLabels>;
}

/**
 * Rows under a heading — a `<section>` named by its `<h3>`, so a screen reader moves between them —
 * with the heading's tally beside it and not in its name: the region is *ProjectShape*, and the
 * counts are what it holds. The rows are the caller's, `FindingRow` and `FindingGroupRow` or
 * anything built on `Diagnostic`.
 */
export const FindingsGroup = (props: FindingsGroupProps) => {
  const { title, tally, labels, children, className, slot, ...rest } = props;
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

export interface FindingsContentProps extends React.ComponentProps<typeof PopoverContent> {
  /** Above the list and not scrolling with it — *shapes.ttl* and *Change…*, say. */
  header?: React.ReactNode;
  /** Drawn instead of the list when nothing was found, or nothing checked. */
  empty?: React.ReactNode;
}

/**
 * The popover: the host's header, then the list — or the empty slot — in a vertical-only
 * `ScrollArea`. **A fixed width and a vertical area**: Ark's content is `min-width: fit-content`
 * on both axes, so one unbroken line would set the popover's width; see `ScrollArea`'s
 * `orientation`.
 */
export const FindingsContent = (props: FindingsContentProps) => {
  const { header, empty, children, className, slot, ...rest } = props;
  const { tally } = useFindings();
  const popover = usePopover();
  const close = React.useCallback(() => popover.setOpen(false), [popover]);
  const found = Boolean(tally && tally.total > 0);

  return (
    <PopoverContent
      className={cn("max-h-[min(32rem,70vh)] w-[min(28rem,calc(100vw-2rem))]", className)}
      {...rest}
      slot={slot ?? "findings-content"}
    >
      {header}
      <ScrollArea className="flex min-h-0 flex-1 flex-col" orientation="vertical">
        <ark.div
          className={cn("flex min-w-0 flex-col gap-4 p-(--space)", header ? "pt-1" : null)}
          data-slot="findings-list"
        >
          <CloseContext.Provider value={close}>{found ? children : empty}</CloseContext.Provider>
        </ark.div>
      </ScrollArea>
    </PopoverContent>
  );
};
