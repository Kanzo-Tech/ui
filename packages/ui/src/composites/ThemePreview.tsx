"use client";

import * as React from "react";
import { themeIndex, type Appearance } from "@kanzo-tech/theme";
import { cn } from "../lib/cn.js";
import { KanzoTheme } from "../theme/KanzoTheme.js";
import { useKanzoThemeOptional } from "../theme/theme-context.js";

export interface ThemePreviewProps extends React.ComponentPropsWithoutRef<"div"> {
  /** The theme to paint, by name. Omit to inherit the surrounding cascade — a pane carrying a theme
   *  as inline custom properties, which is how the theme generator previews one it has not shipped. */
  theme?: string;
  /** The side to paint. Defaults to the theme's own, read off the provider's `themes` or the
   *  shipped catalogue. */
  appearance?: Appearance;
}

/**
 * A miniature of an app screen, painted by a theme: a header with the brand mark and a primary
 * button, a sidebar with its active row, lines of text in both inks, and a line of code in the
 * `--syntax-*` colours.
 *
 * **Nothing here is data.** It is a scoped {@link KanzoTheme}, so every utility inside resolves
 * against the named theme's own tokens — the same cascade a page wearing it would get, at a size
 * that fits on a radio card. GitHub's appearance tiles are drawn assets; this is the theme.
 *
 * Decorative (`aria-hidden`): whatever offers the theme names it.
 */
export function ThemePreview({ theme, appearance, className, ...rest }: ThemePreviewProps) {
  const ctx = useKanzoThemeOptional();
  const entry = theme
    ? (ctx?.themes.find((t) => t.value === theme) ?? themeIndex.find((t) => t.value === theme))
    : undefined;
  const side = appearance ?? (entry ? (entry.dark ? "dark" : "light") : undefined);

  return (
    <KanzoTheme aria-hidden appearance={side} className={cn("block", className)} theme={theme} {...rest}>
      <div
        className="flex aspect-[16/10] flex-col overflow-hidden rounded-box border border-border bg-background font-sans text-foreground"
        data-slot="theme-preview"
      >
        <div className="flex h-[17%] shrink-0 items-center gap-[4%] border-border border-b bg-card px-[5%]">
          <span className="aspect-square h-[42%] shrink-0 rounded-selector bg-primary" />
          <span className="h-[18%] w-[22%] rounded-full bg-foreground" />
          <span className="ms-auto flex h-[52%] w-[20%] items-center justify-center rounded-field bg-primary">
            <span className="h-[30%] w-1/2 rounded-full bg-primary-foreground" />
          </span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[27%] shrink-0 flex-col gap-[7%] border-border border-e bg-sidebar p-[5%]">
            <span className="h-[5%] w-3/4 rounded-full bg-sidebar-foreground" />
            <span className="flex h-[12%] items-center rounded-selector bg-accent px-[10%]">
              <span className="h-[40%] w-2/3 rounded-full bg-foreground" />
            </span>
            <span className="h-[5%] w-2/3 rounded-full bg-sidebar-foreground" />
            <span className="h-[5%] w-1/2 rounded-full bg-sidebar-foreground" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[6%] p-[6%]">
            <span className="h-[7%] w-1/2 rounded-full bg-foreground" />
            <span className="h-[4%] w-5/6 rounded-full bg-muted-foreground" />
            <span className="h-[4%] w-2/3 rounded-full bg-muted-foreground" />
            <span className="mt-auto flex flex-col gap-[10%] rounded-field bg-muted px-[5%] py-[4%]">
              <span className="flex h-[10%] min-h-1 gap-[4%]">
                <span className="w-[16%] rounded-full bg-[var(--syntax-keyword)]" />
                <span className="w-[20%] rounded-full bg-[var(--syntax-variable)]" />
                <span className="w-[14%] rounded-full bg-[var(--syntax-annotation)]" />
                <span className="w-[22%] rounded-full bg-[var(--syntax-function)]" />
              </span>
              <span className="flex h-[10%] min-h-1 gap-[4%] ps-[8%]">
                <span className="w-[18%] rounded-full bg-[var(--syntax-property)]" />
                <span className="w-[26%] rounded-full bg-[var(--syntax-string)]" />
                <span className="w-[10%] rounded-full bg-[var(--syntax-number)]" />
                <span className="w-[16%] rounded-full bg-[var(--syntax-type)]" />
              </span>
            </span>
          </div>
        </div>
      </div>
    </KanzoTheme>
  );
}
