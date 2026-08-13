"use client";

import {
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
          panel: the two font axes, and nothing else.
        </>
      }
      panel={
        <PreferencesRoot defaultOpen hotkey="p">
          <PreferencesTrigger />
          <PreferencesPanel title="Typography">
            <PreferencesFont />
            <PreferencesMonoFont />
          </PreferencesPanel>
        </PreferencesRoot>
      }
    />
  );
}

export default PreferencesFontsShowcase;
