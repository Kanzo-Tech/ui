"use client";

import { ark } from "@ark-ui/react/factory";
import { BrainIcon } from "lucide-react";
import * as React from "react";
import {
  cn,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
  Spinner,
} from "@kanzo-tech/ui";

const Ctx = React.createContext<{ streaming: boolean; seconds: number | null }>({
  seconds: null,
  streaming: false,
});

/**
 * How long the thinking is left on screen after it stops. AI Elements' `AUTO_CLOSE_DELAY`, and the
 * reason is the last sentence: closing on the instant the stream ends takes the end of the thought
 * away from the reader who was reading it.
 */
const LINGER = 1000;
const MS_IN_S = 1000;

export interface ReasoningProps extends React.ComponentProps<typeof Collapsible> {
  /** The model is still thinking. */
  streaming?: boolean;
}

/**
 * A model's thinking, folded away.
 *
 * The behaviour that *is* the component: it opens itself when the thinking starts and closes itself
 * when it ends, so the reader watches it happen without being left with a wall of it afterwards.
 * One exception, and it is the reason for the ref rather than a plain effect — **a reader's own
 * toggle ends the automatic behaviour for good.** Anything else means a panel that reopens what
 * somebody just closed, which is the version of this everyone has met.
 *
 * `group/reasoning` sits beside `Collapsible`'s own `group/collapsible`: the parts below key off
 * `data-streaming`, which is this component's, not the machine's.
 */
export const Reasoning = (props: ReasoningProps) => {
  const {
    streaming = false,
    open,
    defaultOpen = false,
    onOpenChange,
    className,
    children,
    slot,
    ...rest
  } = props;
  const [selfOpen, setSelfOpen] = React.useState(defaultOpen);
  const [seconds, setSeconds] = React.useState<number | null>(null);
  const touched = React.useRef(false);
  const wasStreaming = React.useRef(false);
  const startedAt = React.useRef<number | null>(null);

  /**
   * **How long it thought, because the trigger says so once it is folded away.** Taken from AI
   * Elements, where the closed state reads *Thought for N seconds* rather than a static label — a
   * disclosure that says nothing about what is behind it gives the reader no reason to open it.
   *
   * Rounded up, and `null` until there is something to report: a block that never streamed has no
   * duration, which is not the same as a duration of zero.
   */
  React.useEffect(() => {
    if (streaming) {
      startedAt.current ??= Date.now();
      return;
    }
    if (startedAt.current === null) return;
    setSeconds(Math.max(1, Math.ceil((Date.now() - startedAt.current) / MS_IN_S)));
    startedAt.current = null;
  }, [streaming]);

  React.useEffect(() => {
    if (streaming === wasStreaming.current) return;
    wasStreaming.current = streaming;
    if (touched.current) return;
    if (streaming) {
      setSelfOpen(true);
      return;
    }
    // It lingers. Closing on the instant the last token lands snatches the end of the thought away
    // from somebody mid-sentence, and this is the one beat that makes the fold readable.
    const timer = setTimeout(() => setSelfOpen(false), LINGER);
    return () => clearTimeout(timer);
  }, [streaming]);

  return (
    <Ctx.Provider value={{ seconds, streaming }}>
      <Collapsible
        className={cn("group/reasoning w-full", className)}
        data-streaming={streaming ? "" : undefined}
        onOpenChange={(details) => {
          touched.current = true;
          setSelfOpen(details.open);
          onOpenChange?.(details);
        }}
        open={open ?? selfOpen}
        {...rest}
        slot={slot ?? "reasoning"}
      >
        {children}
      </Collapsible>
    </Ctx.Provider>
  );
};

/**
 * What the trigger says, which is the only thing a folded-away thought tells anybody.
 *
 * **`Spinner` and not a shimmer, and that is a deliberate divergence.** AI Elements shimmers the
 * word *Thinking...* — a gradient swept across the glyphs with `background-clip: text`, on a
 * `motion/react` loop. It is a second vocabulary for *busy* beside the one this library already
 * has, and it costs an animation library to say what a `Spinner` says. Every other busy surface
 * here spins; the ✨ spins while a completion streams. One busy is a house principle, and AI
 * Elements is a source rather than a reference.
 */
const label = (streaming: boolean, seconds: number | null) => {
  if (streaming) return "Thinking…";
  if (seconds === null) return "Reasoning";
  return `Thought for ${seconds} second${seconds === 1 ? "" : "s"}`;
};

/**
 * The disclosure itself, sized to its own words rather than to the column: thinking is subordinate
 * to the answer beside it, and a full-width bar with a chevron at the far end reads as a section
 * heading — the one thing this is not.
 */
export const ReasoningTrigger = (props: React.ComponentProps<typeof CollapsibleTrigger>) => {
  const { className, children, slot, ...rest } = props;
  const { seconds, streaming } = React.useContext(Ctx);

  return (
    <CollapsibleTrigger
      className={cn(
        "-ms-1.5 inline-flex min-h-[24px] w-fit items-center gap-1.5 rounded-md px-1.5 py-1",
        "text-muted-foreground text-xs",
        "transition-colors hover:bg-accent hover:text-foreground motion-reduce:transition-none!",
        "group-data-streaming/reasoning:text-info-foreground",
        "[&_svg:not([class*='size-'])]:size-3.5",
        className
      )}
      {...rest}
      slot={slot ?? "reasoning-trigger"}
    >
      {streaming ? <Spinner aria-hidden className="size-3.5" /> : <BrainIcon />}
      <ark.span className="text-start font-medium">
        {children ?? label(streaming, seconds)}
      </ark.span>
      <CollapsibleIndicator className="opacity-64" />
    </CollapsibleTrigger>
  );
};

/**
 * The thinking, on a rail rather than in a panel — a quotation of the model to itself, and quieter
 * than any message beside it. The rail takes the streaming tint so a wall of text that is still
 * growing says so at the edge, where it does not move the words.
 */
export const ReasoningContent = (props: React.ComponentProps<typeof CollapsibleContent>) => {
  const { className, slot, ...rest } = props;

  return (
    <CollapsibleContent
      className={cn(
        "mt-1 ms-2.5 whitespace-pre-wrap break-words",
        "border-border border-s ps-3.5",
        "text-muted-foreground text-sm leading-relaxed",
        "group-data-streaming/reasoning:border-info",
        "transition-colors motion-reduce:transition-none!",
        className
      )}
      {...rest}
      slot={slot ?? "reasoning-content"}
    />
  );
};
