"use client";

import { AppearanceToggle, Button, ButtonGroup, useKanzoTheme } from "@kanzo-tech/ui";

// `system` is the initial value, not a stop on the cycle — so a product that wants an explicit
// way back writes one. This is what Preferences' Reset does for the whole prefs blob.
export default function Example() {
  const { setAppearance } = useKanzoTheme();

  return (
    <ButtonGroup aria-label="Appearance">
      <AppearanceToggle size="icon-md" variant="outline" />
      <Button onClick={() => setAppearance("system")} variant="outline">
        Follow the OS
      </Button>
    </ButtonGroup>
  );
}
