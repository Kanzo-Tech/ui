"use client";

import { resolveTokenColor, Swatch, useThemeTick } from "@kanzo-tech/ui";
import { useEffect, useRef, useState } from "react";

export interface TokenScaleViewProps {
  families: readonly string[];
  /** Step → the obligation ids the ramp owes it, from `OBLIGATIONS`. Empty means no duty. */
  duties: Record<number, string[]>;
}

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * The reference tier, read off the page it is drawn on.
 *
 * The values are resolved with `resolveTokenColor` rather than imported, so this strip shows
 * whichever document the reader is wearing and repaints when they change it — the same path a chart
 * takes, and the reason it re-reads on `useThemeTick`. An imported table would be a second copy of
 * the sheet, which is the defect the tier below it was just cut for.
 */
export function TokenScaleView({ families, duties }: TokenScaleViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const tick = useThemeTick();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const next: Record<string, string> = {};
    for (const family of families) {
      for (const step of STEPS) {
        next[`${family}-${step}`] = resolveTokenColor(host, `--${family}-${step}`);
        next[`${family}-a${step}`] = resolveTokenColor(host, `--${family}-a${step}`);
      }
    }
    setValues(next);
  }, [families, tick]);

  return (
    <div className="not-prose flex flex-col gap-8" ref={hostRef}>
      {families.map((family) => (
        <section className="flex flex-col gap-2" key={family}>
          <h3 className="font-medium font-mono text-sm">--{family}-*</h3>

          <div className="grid grid-cols-12 gap-1">
            {STEPS.map((step) => (
              <div className="flex flex-col gap-1" key={step}>
                <Swatch
                  className="h-10 w-full rounded-sm ring-1 ring-border ring-inset"
                  color={values[`${family}-${step}`] ?? "transparent"}
                  title={`--${family}-${step}: ${values[`${family}-${step}`] ?? "…"}`}
                />
                <Swatch
                  className="h-5 w-full rounded-sm ring-1 ring-border ring-inset"
                  color={values[`${family}-a${step}`] ?? "transparent"}
                  title={`--${family}-a${step}: ${values[`${family}-a${step}`] ?? "…"}`}
                />
                <span className="text-center font-mono text-muted-foreground text-xs">{step}</span>
                <span className="text-balance text-center text-[10px] text-muted-foreground leading-tight">
                  {duties[step]?.join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
