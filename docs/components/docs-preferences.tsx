"use client";

import { SlidersHorizontal } from "lucide-react";
import { AppearanceToggle, DialogTrigger, PreferencesPanel, PreferencesRoot } from "@kanzo-tech/ui";

/**
 * Live theme customizer for the docs chrome — the appearance toggle and the full Preferences
 * panel, co-located as ONE left-aligned controls cluster in the sidebar footer.
 *
 * The panel is NOT hand-rolled: it is the library's own `Preferences` composite, mounted here via
 * `PreferencesRoot` (the non-modal drawer) + `PreferencesPanel` (the canonical body: Colour ·
 * Density · Radius · Font · Mono font, plus Reset · Done). Composed from the FLAT part exports, not
 * the `Preferences.X` statics, which read back `undefined` across the RSC client boundary (the
 * library documents this).
 *
 * **Colour appears here because these docs publish six palettes**, and `PreferencesColor` hides
 * itself below two choices — a tenant shipping one identity sees the four non-colour axes and
 * nothing else. What it offers is still not a hue: each entry is a whole palette DOCUMENT someone
 * already derived and measured, so the reader picks among validated identities rather than authoring
 * a colour. See [Theming](/docs/theming). Appearance is not a section either, for a different
 * reason: it has exactly one control, the toggle to the left of Customize, which cycles
 * light → dark → system in one click.
 *
 * No `hotkey`: the library gives the prop no default on purpose, and a docs site is a host whose
 * global keymap is not ours to claim.
 *
 * Persistence, restore-on-load and the live re-theme are handled upstream by `KanzoThemeProvider`
 * (the docs wrap in it via `kanzo-provider.tsx`): it writes the four non-colour `data-*` axes to
 * `<html>`, toggles `.dark` from the resolved appearance, and persists the lot to localStorage.
 * Because the attributes land on the docs root, every inline `ComponentPreview` example re-themes
 * in real time.
 *
 * Layout: the appearance control and Customize read as one group. Both fumadocs theme controls are
 * gone — the one in its own row (`themeSwitch={{ enabled: false }}` on the layout) and the
 * `ThemeSwitch` that used to sit here. The latter calls `useTheme()`, so with next-themes disabled
 * it became a button that changes nothing; `AppearanceToggle` is the DS's own. The Customize
 * trigger is our own `DialogTrigger` (the same Ark Dialog `PreferencesRoot` provides), styled in
 * fumadocs' `fd-*` chrome tokens; `data-[state=open]` is Ark's — it keeps the button lit while the
 * non-modal panel stays open.
 */
export function DocsPreferences() {
  return (
    <div className="mt-2 flex items-center gap-2">
      <AppearanceToggle />
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
