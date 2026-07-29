"use client";

import {
  PreferencesDensity,
  PreferencesField,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  PreferencesTrigger,
  SegmentGroup,
} from "@kanzo-tech/ui";
import { useState } from "react";
import { SettingsBackdrop } from "./backdrop";

type SidebarSide = "start" | "end";

// Extending the panel: a product section on top, the library's theme axes (flat parts) below.
export function PreferencesExtendedShowcase() {
  const [sidebarSide, setSidebarSide] = useState<SidebarSide>("start");

  return (
    <SettingsBackdrop
      description={
        <>
          The panel takes any children, so a product can lead with its own preferences and then
          fall back to the library's theme axes — all in one drawer. Here a product{" "}
          <code>Sidebar side</code> control sits above the theme sections.
        </>
      }
      panel={
        <PreferencesRoot defaultOpen hotkey="t">
          <PreferencesTrigger />
          <PreferencesPanel title="Preferences">
            <PreferencesField label="Sidebar side">
              <SegmentGroup
                aria-label="Sidebar side"
                className="w-full"
                onValueChange={(d) => d.value && setSidebarSide(d.value as SidebarSide)}
                value={sidebarSide}
                variant="solid"
                options={[
                  { value: "start", label: "Start" },
                  { value: "end", label: "End" },
                ]}
                itemClassName="px-2 py-1"
              />
            </PreferencesField>

            <PreferencesRadius />
            <PreferencesDensity />
          </PreferencesPanel>
        </PreferencesRoot>
      }
    />
  );
}

export default PreferencesExtendedShowcase;
