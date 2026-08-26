"use client";

// The one settings surface this screen has, and it is the library's own.
//
// The key had to go somewhere the moment the live model moved into the browser, and the answer
// was NOT a dialog of ours beside the panel: that is the several-products-in-one-window failure
// a contributed preference section exists to remove. A host composes the
// panel from the flat part exports and adds its own field — `PreferencesField` is exported for
// exactly this, and `PreferencesSections` is listed explicitly because `children` REPLACES the
// canonical body, so a composed panel that forgot it would silently drop every choice an
// installed package contributes.
//
// The key is not a contributed preference and could not be one. A section's values are strings in
// the theme's prefs blob, and in these docs that blob is a COOKIE — a secret there would travel to
// the server on every request, which is the arrangement retiring the route handler was meant to
// end. It lives in `localStorage` under the showcase's own name; see `live.ts`.

import {
  PasswordInput,
  PasswordInputGroup,
  PasswordInputInput,
  PasswordInputTrigger,
  PreferencesColor,
  PreferencesDensity,
  PreferencesField,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesPanel,
  PreferencesRadius,
  PreferencesRoot,
  PreferencesSections,
  PreferencesTrigger,
} from "@kanzo-tech/ui";

export function FieldNotesPreferences({
  apiKey,
  onApiKey,
}: {
  apiKey: string;
  onApiKey: (key: string) => void;
}) {
  return (
    <PreferencesRoot>
      {/* The library's own FAB — fixed bottom-end, a palette on a round surface. A preference is
          not one of this screen's verbs, and in the header it read as one. */}
      <PreferencesTrigger />
      <PreferencesPanel>
        <PreferencesColor />
        <PreferencesDensity />
        <PreferencesRadius />
        <PreferencesFont />
        <PreferencesMonoFont />
        <PreferencesSections />
        <PreferencesField label="Anthropic API key">
          <PasswordInput size="sm">
            <PasswordInputGroup>
              <PasswordInputInput
                autoComplete="off"
                onChange={(e) => onApiKey(e.target.value)}
                placeholder="sk-ant-…"
                value={apiKey}
              />
              <PasswordInputTrigger />
            </PasswordInputGroup>
          </PasswordInput>
          <p className="mt-1.5 text-muted-foreground text-xs">
            Yours, and it stays in this browser. It is what turns <strong>Live model</strong> on;
            the recorded run needs none.
          </p>
        </PreferencesField>
      </PreferencesPanel>
    </PreferencesRoot>
  );
}

export default FieldNotesPreferences;
