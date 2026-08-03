"use client";

import { AppearanceToggle, Button, ButtonGroup, useKanzoTheme } from "@kanzo-tech/ui";

// Following the OS is `null` — the absence of a pinned side, not a third value — so a product that
// wants an explicit way back writes one, and `null` is what it writes. This is what Preferences'
// Reset does for the whole prefs blob.
export default function Example() {
  const { setAppearance } = useKanzoTheme();

  // No `disabled={appearance === null}`: the preference is browser state, so the server would render
  // one value and the client another — a hydration mismatch on an attribute React does not patch.
  return (
    <ButtonGroup aria-label="Appearance">
      <AppearanceToggle size="icon-md" variant="outline" />
      <Button onClick={() => setAppearance(null)} variant="outline">
        Follow the OS
      </Button>
    </ButtonGroup>
  );
}
