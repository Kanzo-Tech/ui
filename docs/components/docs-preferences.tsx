"use client";

import { SlidersHorizontal } from "lucide-react";
import {
  Button,
  DialogTrigger,
  PreferencesDensity,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  PreferencesSections,
} from "@kanzo-tech/ui";

/**
 * Live theme customizer for the docs chrome — the Preferences panel, in the sidebar footer.
 *
 * The panel is NOT hand-rolled: it is the library's own `Preferences` composite, mounted here via
 * `PreferencesRoot` (the non-modal drawer) + `PreferencesPanel` (the canonical body: Colour ·
 * Density · Radius · Font · Mono font, plus Reset · Done). Composed from the FLAT part exports, not
 * the `Preferences.X` statics, which read back `undefined` across the RSC client boundary (the
 * library documents this).
 *
 * **Colour is NOT here, and this site is the exception rather than the rule.** The panel's default
 * body opens with `PreferencesColor`, which is right for the tenant it was written for: two themes,
 * no menu, one place to choose. This site publishes twenty-nine and puts them in the chrome, so
 * colour lives in `ThemeMenu` — the whole axis, appearance included, because "follow the OS" is the
 * state with no value and belongs beside the sides rather than three clicks away from them. Leaving
 * `PreferencesColor` mounted as well would be two controls for one preference, twelve pixels apart
 * in the same corner of the screen.
 *
 * So the body is composed rather than defaulted, and that is what `children` on `PreferencesPanel`
 * is for — the same seam the `-fonts` and `-extended` showcases use. **Nothing in the library
 * changed to allow it**: the five sections are exported flat precisely so a host can pick.
 *
 * `PreferencesSections` stays last and is empty today — no package registers a section with this
 * provider — but it is what a contributed preference would arrive through, and leaving it out would
 * make that arrival a change here rather than a change there.
 *
 * No `hotkey`: the library gives the prop no default on purpose, and a docs site is a host whose
 * global keymap is not ours to claim.
 *
 * Persistence, restore-on-load and the live re-theme are handled upstream by `KanzoThemeProvider`
 * (the docs wrap in it via `kanzo-provider.tsx`): it writes the four non-colour `data-*` axes to
 * `<html>`, toggles `.dark` from the resolved appearance, and persists the lot to localStorage.
 * Because the attributes land on the docs root — and `global.css` maps fumadocs' own `--color-fd-*`
 * onto the theme's tokens — the sidebar, the nav and every inline `ComponentPreview` example
 * re-theme together.
 *
 * The trigger is the library's own `Button` through `DialogTrigger` (the same Ark Dialog
 * `PreferencesRoot` provides). It used to be a `<button>` with a hand-written string of `fd-*`
 * chrome classes, which was the honest thing while the chrome had a palette of its own; it has ours
 * now, so the class string was a second spelling of `variant="outline"`. `data-[state=open]` is
 * Ark's — it keeps the button lit while the non-modal panel stays open.
 */
export function DocsPreferences() {
  return (
    <div className="mt-2 flex items-center gap-2">
      <PreferencesRoot>
        <DialogTrigger asChild>
          <Button
            aria-label="Customize theme"
            className="w-full justify-start gap-2 font-normal data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
            type="button"
            variant="outline"
          >
            <SlidersHorizontal className="size-4.5" />
            Customize
          </Button>
        </DialogTrigger>
        <PreferencesPanel hint="Applied live · saved to this browser. Colour is in the theme menu.">
          <PreferencesDensity />
          <PreferencesRadius />
          <PreferencesFont />
          <PreferencesMonoFont />
          <PreferencesSections />
        </PreferencesPanel>
      </PreferencesRoot>
    </div>
  );
}

export default DocsPreferences;
