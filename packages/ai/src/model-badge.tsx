"use client";

import { ark } from "@ark-ui/react/factory";
import { CircleCheckIcon, CircleDashedIcon, CircleXIcon } from "lucide-react";
import type React from "react";
import type { ModelLoad } from "@kanzo-tech/llm";
import {
  Badge,
  type BadgeVariant,
  Button,
  cn,
  DiagnosticList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Problem,
  type ProblemProps,
  Progress,
  Spinner,
} from "@kanzo-tech/ui";

/** Every word `ModelBadge` draws. English by default. */
export interface ModelBadgeTranslations {
  /** The badge before anything loads or asks the model. */
  idle: string;
  /** The badge while it downloads and loads; the percentage follows it. */
  loading: string;
  ready: string;
  failed: string;
  /** In the popover, before anything loads or asks the model. */
  idleDetail: string;
  /** In the popover, once it is loaded. */
  readyDetail: string;
  /** The button that starts a failed load again. */
  retry: string;
}

const ENGLISH: ModelBadgeTranslations = {
  idle: "Model",
  loading: "Preparing the model",
  ready: "Model ready",
  failed: "Model failed",
  idleDetail: "The model loads on this device when it is first asked.",
  readyDetail: "The model runs on this device; a question starts at once.",
  retry: "Try again",
};

const LOOK: Record<ModelLoad["state"], { variant: BadgeVariant; icon: React.ReactNode }> = {
  idle: { variant: "outline", icon: <CircleDashedIcon aria-hidden /> },
  loading: { variant: "info", icon: <Spinner aria-hidden /> },
  ready: { variant: "success", icon: <CircleCheckIcon aria-hidden /> },
  failed: { variant: "destructive", icon: <CircleXIcon aria-hidden /> },
};

export interface ModelBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant" | "children"> {
  /** Where the load stands: `@kanzo-tech/llm/local`'s `localModelLoad`, or the host's own. */
  load: ModelLoad;
  /** Starts the load again — `loadLocalModel`. Offered on a failure the device can recover from. */
  onRetry?: () => void;
  /** The host's words for a failure's code, as `Problem` takes them. */
  describe?: ProblemProps["describe"];
  translations?: Partial<ModelBadgeTranslations>;
}

/**
 * A model the page fetches before it answers, as a badge — AI Elements' `Context` in shape: a small
 * trigger that says where the model stands, and the detail behind it. *Preparing the model · 42%*
 * while it downloads and loads, *Model ready*, *Model failed*; pressed, it opens the bar and the
 * engine's own words, or the failure as a `Problem`.
 *
 * **A popover, not `Context`'s hover card.** A failure carries a retry, and what a hover card holds
 * cannot be reached by the keyboard or on touch; `FindingsBadge` is the same badge-and-popover for the
 * same reason. **No retry for `ai/unavailable`**: that code is the device — no WebGPU, no model served
 * — and a second try ends the same way.
 *
 * ARIA: the badge is a button named by its words, percentage included; Ark's popover gives it
 * `aria-expanded` and `aria-controls`, and moves focus into the content and back.
 */
export function ModelBadge(props: ModelBadgeProps) {
  const { load, onRetry, describe, translations, className, slot, ...rest } = props;
  const t = { ...ENGLISH, ...translations };
  const { variant, icon } = LOOK[load.state];
  const percent = load.state === "loading" ? Math.round(load.progress * 100) : null;
  const recoverable = load.state === "failed" && (load.error as { code?: unknown } | null)?.code !== "ai/unavailable";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge asChild className={cn("tabular-nums", className)} data-load={load.state} pill variant={variant} {...rest} slot={slot ?? "model-badge"}>
          <ark.button type="button">
            {icon}
            {t[load.state]}
            {percent !== null && ` · ${percent}%`}
          </ark.button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] gap-3 text-sm" slot="model-badge-content">
        {load.state === "loading" && (
          <>
            <Progress value={percent ?? 0} />
            {load.text && <p className="text-muted-foreground text-xs">{load.text}</p>}
          </>
        )}
        {load.state === "idle" && <p className="text-muted-foreground">{t.idleDetail}</p>}
        {load.state === "ready" && <p className="text-muted-foreground">{t.readyDetail}</p>}
        {load.state === "failed" && (
          <DiagnosticList>
            <Problem describe={describe} error={load.error}>
              {onRetry && recoverable && (
                <Button onClick={onRetry} size="sm" variant="outline">
                  {t.retry}
                </Button>
              )}
            </Problem>
          </DiagnosticList>
        )}
      </PopoverContent>
    </Popover>
  );
}
