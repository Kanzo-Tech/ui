"use client";

import { SlidersHorizontal } from "lucide-react";
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { DialogTrigger, PreferencesPanel, PreferencesRoot } from "@kanzo-tech/ui";

/**
 * Live theme customizer for the docs chrome — the appearance toggle and the full Preferences
 * panel, co-located as ONE left-aligned controls cluster in the sidebar footer.
 *
 * The panel is NOT hand-rolled: it is the library's own `Preferences` composite, mounted here via
 * `PreferencesRoot` (the non-modal drawer) + `PreferencesPanel` (the canonical seven-section body:
 * Appearance · Accent · Base · Radius · Font · Mono font · Density, plus Reset · Copy CSS · Done).
 * Composed from the FLAT part exports, not the `Preferences.X` statics, which read back `undefined`
 * across the RSC client boundary (the library documents this).
 *
 * Persistence, restore-on-load and the live re-theme are handled upstream by `KanzoThemeProvider`
 * (the docs wrap in it via `kanzo-provider.tsx`): it writes the `data-*` axes to `<html>` and
 * persists them to localStorage, and appearance is delegated to next-themes. Because the attributes
 * land on the docs root, every inline `ComponentPreview` example re-themes in real time.
 *
 * Layout: the light/dark control and Customize read as one group. The default fumadocs theme
 * toggle is disabled (`themeSwitch={{ enabled: false }}` on the layout) so it does not render in
 * its own row; instead we place fumadocs' own `ThemeSwitch` (next-themes-backed, the identical
 * pill) immediately beside our Customize trigger. The trigger is our own `DialogTrigger` (the same
 * Ark Dialog `PreferencesRoot` provides), styled in fumadocs' `fd-*` chrome tokens; `data-[state=open]`
 * is Ark's — it keeps the button lit while the non-modal panel stays open.
 */
export function DocsPreferences() {
  return (
    <div className="mt-2 flex items-center gap-2">
      <ThemeSwitch mode="light-dark" />
      <PreferencesRoot>
        <DialogTrigger asChild>
          <button
            type="button"
            aria-label="Customize theme"
            className="inline-flex items-center gap-2 rounded-lg border bg-fd-secondary/50 px-3 py-1.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground"
          >
            <SlidersHorizontal className="size-4.5" />
            Customize
          </button>
        </DialogTrigger>
        <PreferencesPanel />
      </PreferencesRoot>
    </div>
  );
}

export default DocsPreferences;
