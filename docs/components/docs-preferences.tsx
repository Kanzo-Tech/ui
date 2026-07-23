"use client";

import { SlidersHorizontal } from "lucide-react";
import { DialogTrigger, PreferencesPanel, PreferencesRoot } from "@kanzo-tech/ui";

/**
 * Live theme customizer for the docs chrome.
 *
 * This is NOT hand-rolled: it is the library's own `Preferences` composite, mounted in the docs.
 * `PreferencesRoot` wires the (non-modal) drawer and `PreferencesPanel` renders the canonical
 * seven-section body — Appearance · Accent · Base · Radius · Font · Mono font · Density — plus the
 * Reset · Copy CSS · Done footer. Composed from the FLAT part exports, not the `Preferences.X`
 * statics, which read back `undefined` across the RSC client boundary (the library documents this).
 *
 * Persistence, restore-on-load and the live re-theme are all already handled upstream:
 * `KanzoThemeProvider` (the docs wrap in it via `kanzo-provider.tsx`) writes the `data-*` axes to
 * `<html>` and persists them to localStorage, and appearance is delegated to next-themes. Because
 * the attributes land on the docs root, every inline `ComponentPreview` example re-themes in real
 * time with zero extra wiring.
 *
 * The only bespoke piece is the trigger: the default `PreferencesTrigger` is a fixed FAB, but the
 * docs want a control in the chrome next to the theme toggle. So we drop our own `DialogTrigger`
 * (the same Ark Dialog `PreferencesRoot` provides) styled with fumadocs' `fd-*` chrome tokens so it
 * reads as part of the sidebar footer. `data-[state=open]` is Ark's — it keeps the button lit while
 * the non-modal panel stays open.
 */
export function DocsPreferences() {
  return (
    <PreferencesRoot>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Customize theme"
          className="mt-2 inline-flex w-full items-center gap-2 rounded-lg border bg-fd-secondary/50 px-3 py-2 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground"
        >
          <SlidersHorizontal className="size-4.5" />
          Customize
        </button>
      </DialogTrigger>
      <PreferencesPanel />
    </PreferencesRoot>
  );
}

export default DocsPreferences;
