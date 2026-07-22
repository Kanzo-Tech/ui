import {
  PreferencesAccent,
  PreferencesAppearance,
  PreferencesDensity,
  PreferencesRadius,
} from "@kanzo-tech/ui";

export default function Example() {
  // Flat parts, not `Preferences.Accent`: the namespace is built with `Object.assign`, and
  // those statics do not survive the RSC client boundary. The sections are exported
  // individually so a product can drop them into its own settings page instead of the
  // floating drawer — they edit the same live theme either way.
  return (
    <div className="flex w-80 flex-col gap-6 rounded-lg border bg-popover p-5">
      <PreferencesAppearance />
      <PreferencesAccent />
      <PreferencesRadius />
      <PreferencesDensity />
    </div>
  );
}
