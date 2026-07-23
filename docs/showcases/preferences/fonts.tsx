"use client";

import {
  PreferencesBase,
  PreferencesCopyTheme,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesPanel,
  PreferencesRoot,
  PreferencesTrigger,
} from "@kanzo-tech/ui";
import { SettingsBackdrop } from "./backdrop";

// A custom panel: pass children to PreferencesPanel to pick the sections (typography only here).
export function PreferencesFontsShowcase() {
  return (
    <SettingsBackdrop
      description={
        <>
          A panel is not locked to the canonical section set. Pass your own children to{" "}
          <code>PreferencesPanel</code> and it renders exactly those — here a typography-only
          panel: the two font axes over the neutral base.
        </>
      }
      panel={
        <PreferencesRoot defaultOpen hotkey="t">
          <PreferencesTrigger />
          <PreferencesPanel title="Typography">
            <PreferencesFont />
            <PreferencesMonoFont />
            <PreferencesBase />
            <PreferencesCopyTheme />
          </PreferencesPanel>
        </PreferencesRoot>
      }
    />
  );
}

export default PreferencesFontsShowcase;
