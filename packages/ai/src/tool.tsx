"use client";

import { ark } from "@ark-ui/react/factory";
import { WrenchIcon } from "lucide-react";
import * as React from "react";
import {
  Badge,
  type BadgeVariant,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  JsonTreeView,
} from "@kanzo-tech/ui";
import { RUN_LABEL, RUN_MARK, type RunState } from "./task.js";

/** Which soft badge holds the mark. The mark itself is `Task`'s — one drawing of four states. */
const TONE: Record<RunState, BadgeVariant> = {
  pending: "outline",
  running: "info",
  done: "success",
  failed: "destructive",
};

const LABEL = "mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wide";

// A recess inside the card, and NOT a second frame: the card is already outlined, so a bordered
// panel inside it draws a box in a box on every call in a transcript. The fill alone is the
// separation — which is also what the source does (`bg-muted/50`, no border).
const PANEL = [
  "min-w-0 overflow-x-auto",
  "rounded-lg bg-muted",
  "px-3 py-2 text-xs",
  "[&_code]:font-mono",
].join(" ");

const Ctx = React.createContext<{ state: RunState } | null>(null);
const useCtx = (part: string) => {
  const c = React.useContext(Ctx);
  if (!c) throw new Error(`${part} must render inside <Tool>`);
  return c;
};

export interface ToolProps extends React.ComponentProps<typeof ark.div> {
  state?: RunState;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: React.ComponentProps<typeof Collapsible>["onOpenChange"];
}

/**
 * One call the model made, folded away until it has an answer — reaching `done` or `failed` opens
 * it, and the reader's own toggle ends that for good.
 *
 * **It opens on the transition, not on the initial value, and that distinction is the whole of it.**
 * This was `defaultOpen={defaultOpen ?? state === "done"}`, which Ark's Collapsible reads once at
 * mount: a tool mounted the moment the model plans it — state `pending` — never opened again, not
 * when it finished and not when it failed. Failing silently closed is the worse half: the reason
 * the call failed sat behind a click nobody knew to make. The docblock claimed the opposite, and a
 * showcase had to work around it before anyone noticed.
 *
 * A caller passing `open` still wins outright; `defaultOpen` still decides the first paint.
 *
 * The state sits on a wrapper rather than on the collapsible, and that is not tidiness: Ark writes
 * its own `data-state` (`open` / `closed`) on the machine's root, so a tool state written there
 * replaces it — the parts keep working, and every `[data-state=open]` a consumer wrote stops
 * matching, with nothing to see in a diff.
 */
export const Tool = (props: ToolProps) => {
  const { state = "pending", defaultOpen, open, onOpenChange, className, children, slot, ...rest } =
    props;

  const settled = state === "done" || state === "failed";
  const [selfOpen, setSelfOpen] = React.useState(defaultOpen ?? settled);
  const touched = React.useRef(false);
  const wasSettled = React.useRef(settled);

  React.useEffect(() => {
    if (!touched.current && settled && !wasSettled.current) setSelfOpen(true);
    wasSettled.current = settled;
  }, [settled]);

  return (
    <Ctx.Provider value={{ state }}>
      <ark.div
        className={cn(
          "group/tool w-full overflow-hidden",
          "rounded-xl border bg-card shadow-xs/5",
          className
        )}
        data-state={state}
        {...rest}
        data-slot={slot ?? "tool"}
      >
        <Collapsible
          onOpenChange={(details) => {
            touched.current = true;
            setSelfOpen(details.open);
            onOpenChange?.(details);
          }}
          open={open ?? selfOpen}
          slot="tool-collapsible"
        >
          {children}
        </Collapsible>
      </ark.div>
    </Ctx.Provider>
  );
};

/**
 * The row that says a call happened: the wrench, the tool's name in the face its arguments are
 * written in, the state as a pill, and the chevron the whole row toggles.
 */
export const ToolHeader = (props: React.ComponentProps<typeof CollapsibleTrigger>) => {
  const { className, children, slot, ...rest } = props;
  const { state } = useCtx("ToolHeader");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex min-h-[24px] w-full items-center gap-2.5 px-3 py-2.5 text-sm",
        "transition-colors hover:bg-accent motion-reduce:transition-none!",
        "[&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...rest}
      slot={slot ?? "tool-header"}
    >
      <WrenchIcon className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-start font-medium font-mono">{children}</span>
      <Badge data-state={state} pill size="sm" slot="tool-badge" variant={TONE[state]}>
        {RUN_MARK[state]}
        {RUN_LABEL[state]}
      </Badge>
      <CollapsibleIndicator className="shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
  );
};

export const ToolContent = (props: React.ComponentProps<typeof CollapsibleContent>) => {
  const { className, slot, ...rest } = props;

  return (
    <CollapsibleContent
      // `min-w-0`, and it is the whole reason a wide result was being sliced instead of scrolling: a
      // flex child's default `min-width: auto` refuses to shrink below its content, so the panel
      // below could carry `overflow-x-auto` all it liked and never get the chance to use it. The
      // card is `overflow-hidden`, so what the reader saw was a table with its last column cut off
      // and no scrollbar to recover it.
      className={cn("flex min-w-0 flex-col gap-4 border-t px-3 py-3", className)}
      {...rest}
      slot={slot ?? "tool-content"}
    />
  );
};

export interface ToolIoProps extends React.ComponentProps<typeof ark.div> {
  /** Drawn as a JSON tree when there are no children. */
  data?: unknown;
  /** The small heading over the panel. `null` drops it. */
  label?: string | null;
}

/**
 * What was passed to the call — **children, not a formatted-JSON prop.**
 *
 * The reference takes `input` and renders it as JSON because a general chatbot cannot know what
 * the tool was. We always know: our input is a SQL statement and our output is a result table, and
 * both have a component in this house already. So the payload is composition, and JSON is only the
 * default for when the caller has nothing better — never the one thing on offer.
 *
 * Which is also why the panel does not force a monospace face on everything inside it: a result
 * table set in mono is the cost of a default that assumed JSON. Code sets itself.
 */
export const ToolInput = (props: ToolIoProps) => {
  const { data, label = "Parameters", className, children, slot, ...rest } = props;
  const body = children ?? (data === undefined ? null : <JsonTreeView data={data} />);

  return (
    <ark.div className={cn("min-w-0", className)} {...rest} data-slot={slot ?? "tool-input"}>
      {body === null ? null : (
        <>
          {label === null ? null : (
            <ark.span className={LABEL} data-slot="tool-label">
              {label}
            </ark.span>
          )}
          <ark.div className={PANEL} data-slot="tool-panel">
            {body}
          </ark.div>
        </>
      )}
    </ark.div>
  );
};

/** What came back. Children, for the same reason as {@link ToolInput}. */
export const ToolOutput = (props: ToolIoProps) => {
  const { data, label = "Result", className, children, slot, ...rest } = props;
  const body = children ?? (data === undefined ? null : <JsonTreeView data={data} />);

  return (
    <ark.div
      className={cn("min-w-0", "group-data-[state=failed]/tool:text-destructive-foreground", className)}
      {...rest}
      data-slot={slot ?? "tool-output"}
    >
      {body === null ? null : (
        <>
          {label === null ? null : (
            <ark.span className={LABEL} data-slot="tool-label">
              {label}
            </ark.span>
          )}
          <ark.div
            className={cn(
              PANEL,
              "group-data-[state=failed]/tool:bg-destructive/7"
            )}
            data-slot="tool-panel"
          >
            {body}
          </ark.div>
        </>
      )}
    </ark.div>
  );
};
