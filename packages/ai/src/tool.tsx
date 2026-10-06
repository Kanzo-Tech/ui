"use client";

import { ark } from "@ark-ui/react/factory";
import { CircleCheckIcon, CircleDashedIcon, CircleStopIcon, CircleXIcon, WrenchIcon } from "lucide-react";
import * as React from "react";
import { type DynamicToolUIPart, getToolName, type ToolUIPart } from "@kanzo-tech/llm";
import {
  Badge,
  type BadgeVariant,
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  JsonTreeView,
  Spinner,
} from "@kanzo-tech/ui";

/** A tool call as the AI SDK streams it. */
export type ToolPart = ToolUIPart | DynamicToolUIPart;
type State = ToolPart["state"];

/**
 * The AI SDK's own states, drawn — not mapped onto a vocabulary of ours. Four tones are all a
 * reader needs to tell apart (waiting, working, done, failed); the label says which of the SDK's
 * seven it is.
 */
const LOOK: Record<State, { tone: BadgeVariant; label: string; settled: boolean; failed: boolean }> = {
  "input-streaming": { tone: "info", label: "Preparing", settled: false, failed: false },
  "input-available": { tone: "info", label: "Running", settled: false, failed: false },
  "approval-requested": { tone: "outline", label: "Awaiting approval", settled: false, failed: false },
  "approval-responded": { tone: "info", label: "Running", settled: false, failed: false },
  "output-available": { tone: "success", label: "Done", settled: true, failed: false },
  "output-error": { tone: "destructive", label: "Failed", settled: true, failed: true },
  "output-denied": { tone: "destructive", label: "Denied", settled: true, failed: true },
};

/**
 * A call that will never settle: the reader pressed Stop, or a kept transcript was cut mid-call. The
 * AI SDK has no state for it and leaves the part where it was, so it is drawn from `stopped` — neutral,
 * and still, because nothing is running.
 */
const STOPPED: Look = { tone: "outline", label: "Stopped", settled: false, failed: false };

type Look = (typeof LOOK)[State];

const mark = (look: Look) =>
  look === STOPPED ? (
    <CircleStopIcon className="text-muted-foreground" />
  ) : look.failed ? (
    <CircleXIcon className="text-destructive-foreground" />
  ) : look.settled ? (
    <CircleCheckIcon className="text-success-foreground" />
  ) : look.tone === "outline" ? (
    <CircleDashedIcon className="text-muted-foreground" />
  ) : (
    <Spinner className="text-info-foreground" />
  );

const LABEL = "mb-1.5 block font-medium text-muted-foreground text-xs uppercase tracking-wide";
const PANEL = "min-w-0 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs [&_code]:font-mono";

const Ctx = React.createContext<{ part: ToolPart; look: Look } | null>(null);
const useCall = (name: string) => {
  const call = React.useContext(Ctx);
  if (!call) throw new Error(`${name} must render inside <Tool>`);
  return call;
};

/**
 * One call the model made, bound to its part: state, name, input, output and error are read from
 * it, so a caller passes the part and nothing else.
 *
 * It opens itself when the call settles — a result is what a reader came for — unless the reader
 * has already opened or closed it, in which case their choice stands. The state sits on a wrapper
 * rather than on the collapsible because Ark writes its own `data-state` (`open`/`closed`) there.
 *
 * `stopped` says the call will never settle; `Chat` derives it, since the part alone cannot say so.
 */
export function Tool(props: Omit<React.ComponentProps<typeof ark.div>, "part"> & { part: ToolPart; stopped?: boolean }) {
  const { part, stopped = false, className, children, slot, ...rest } = props;
  const look = stopped && !LOOK[part.state].settled ? STOPPED : LOOK[part.state];
  const [open, setOpen] = React.useState(look.settled);
  const touched = React.useRef(false);
  const wasSettled = React.useRef(look.settled);

  React.useEffect(() => {
    if (!touched.current && look.settled && !wasSettled.current) setOpen(true);
    wasSettled.current = look.settled;
  }, [look.settled]);

  return (
    <Ctx.Provider value={{ part, look }}>
      <ark.div
        className={cn("group/tool w-full overflow-hidden rounded-xl border bg-card shadow-xs/5", className)}
        data-failed={look.failed || undefined}
        data-state={part.state}
        data-stopped={look === STOPPED || undefined}
        {...rest}
        data-slot={slot ?? "tool"}
      >
        <Collapsible
          onOpenChange={(details) => {
            touched.current = true;
            setOpen(details.open);
          }}
          open={open}
          slot="tool-collapsible"
        >
          {children ?? (
            <>
              <ToolHeader />
              <ToolContent>
                <ToolInput />
                <ToolOutput />
              </ToolContent>
            </>
          )}
        </Collapsible>
      </ark.div>
    </Ctx.Provider>
  );
}

/** The tool's name, its state as a pill, and the chevron the whole row toggles. */
export function ToolHeader(props: React.ComponentProps<typeof CollapsibleTrigger>) {
  const { className, children, slot, ...rest } = props;
  const { part, look } = useCall("ToolHeader");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex min-h-[24px] w-full items-center gap-2.5 px-3 py-2.5 text-sm",
        "transition-colors hover:bg-accent motion-reduce:transition-none!",
        "[&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...rest}
      slot={slot ?? "tool-header"}
    >
      <WrenchIcon className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-start font-medium font-mono">
        {children ?? getToolName(part)}
      </span>
      <Badge data-state={part.state} pill size="sm" slot="tool-badge" variant={look.tone}>
        {mark(look)}
        {look.label}
      </Badge>
      <CollapsibleIndicator className="shrink-0 text-muted-foreground" />
    </CollapsibleTrigger>
  );
}

export function ToolContent(props: React.ComponentProps<typeof CollapsibleContent>) {
  const { className, slot, ...rest } = props;
  return (
    <CollapsibleContent
      className={cn("flex min-w-0 flex-col gap-4 border-t px-3 py-3", className)}
      {...rest}
      slot={slot ?? "tool-content"}
    />
  );
}

function Io(props: { label: string; failed?: boolean; slot: string; children: React.ReactNode }) {
  return (
    <ark.div className={cn("min-w-0", props.failed && "text-destructive-foreground")} data-slot={props.slot}>
      <ark.span className={LABEL} data-slot="tool-label">
        {props.label}
      </ark.span>
      <ark.div className={cn(PANEL, props.failed && "bg-destructive/7")} data-slot="tool-panel">
        {props.children}
      </ark.div>
    </ark.div>
  );
}

/** What the model passed in; the JSON tree unless `children` draws it. */
export function ToolInput(props: { children?: React.ReactNode; label?: string }) {
  const { part } = useCall("ToolInput");
  if (props.children === undefined && part.input === undefined) return null;
  return (
    <Io label={props.label ?? "Parameters"} slot="tool-input">
      {props.children ?? <JsonTreeView data={part.input} />}
    </Io>
  );
}

/** What came back — or why nothing did. The JSON tree unless `children` draws it. */
export function ToolOutput(props: { children?: React.ReactNode; label?: string }) {
  const { part } = useCall("ToolOutput");
  if (part.state === "output-error" || part.state === "output-denied") {
    return (
      <Io failed label={props.label ?? "Error"} slot="tool-output">
        {part.state === "output-error" ? part.errorText : "The call was not allowed."}
      </Io>
    );
  }
  if (part.state !== "output-available") return null;
  return (
    <Io label={props.label ?? "Result"} slot="tool-output">
      {props.children ?? <JsonTreeView data={part.output} />}
    </Io>
  );
}
