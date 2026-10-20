"use client";

import { Badge, cn, FormatNumber, Show, Status } from "@kanzo-tech/ui";
import { useGraphState } from "../react/use-graph-state";

/** The one word, per state. */
export interface GraphStatusTranslations {
  loading: string;
  layingOut: string;
  ready: string;
  failed: string;
}

const ENGLISH: GraphStatusTranslations = { loading: "Loading", layingOut: "Laying out", ready: "Ready", failed: "Failed" };

/** `Badge`'s props: the status is a badge, and takes everything one does, `asChild` included. */
export interface GraphStatusProps extends Omit<React.ComponentProps<typeof Badge>, "children"> {
  translations?: Partial<GraphStatusTranslations>;
}

type Word = keyof GraphStatusTranslations;

const TONE = { loading: "info", layingOut: "info", ready: "success", failed: "destructive" } as const;

/**
 * **Where the graph is, in one word** — Loading, Laying out 42%, Ready or Failed. It reads both axes
 * of the state: `status` for the data and `motion` with `progress` for the layout, so a running
 * layout over a drawn graph is "Laying out", never the data's `idle`. A load wins over a layout,
 * and a root with no graph yet reads as Loading: the host is still opening one.
 *
 * ARIA: the word is a polite live region, so a change of word is announced once; the percentage
 * sits outside it, because it moves at frame rate and would be read out on every frame. The badge
 * is `aria-busy` while loading or laying out. The dot is decoration, hidden from the tree.
 */
export function GraphStatus({ className, slot, translations, ...rest }: GraphStatusProps) {
  const t = { ...ENGLISH, ...translations };
  const word = useGraphState((s): Word => {
    if (s.status === "failed") return "failed";
    if (s.status !== "idle") return "loading";
    return s.motion === "running" ? "layingOut" : "ready";
  });
  // Rounded in the selector, so the part re-renders once a percent rather than once a frame.
  const progress = useGraphState((s) => Math.round(s.progress * 100) / 100);
  const busy = word === "loading" || word === "layingOut";

  return (
    <Badge
      aria-busy={busy || undefined}
      size="xs"
      variant="outline"
      {...rest}
      className={cn("gap-1.5 tabular-nums", className)}
      slot={slot ?? "graph-status"}
    >
      <Status className="ring-0" size="sm" variant={TONE[word]} />
      <span aria-live="polite">{t[word]}</span>
      <Show when={word === "layingOut"}>
        <FormatNumber maximumFractionDigits={0} style="percent" value={progress} />
      </Show>
    </Badge>
  );
}
