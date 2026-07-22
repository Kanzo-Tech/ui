import {
  PreferencesAccent,
  PreferencesAppearance,
  PreferencesBase,
  PreferencesCopyTheme,
  PreferencesDensity,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesRadius,
} from "@kanzo-tech/ui";

export default function Example() {
  // Every section the panel ships, stacked vertically in the panel's own order — one
  // control per row, which is how `PreferencesPanel` itself lays them out (`w-80`,
  // `flex flex-col gap-6`). The page used to show four of the eight, which read as if the
  // other four did not exist.
  //
  // Flat parts, not `Preferences.Accent`: the namespace is built with `Object.assign`, and
  // those statics do not survive the RSC client boundary. The sections are exported
  // individually so a product can drop them into its own settings page instead of the
  // floating drawer — they edit the same live theme either way.
  return (
    <div className="flex w-80 flex-col gap-6 rounded-lg border bg-popover p-5">
      <PreferencesAppearance />
      <PreferencesAccent />
      <PreferencesBase />
      <PreferencesRadius />
      <PreferencesFont />
      <PreferencesMonoFont />
      <PreferencesDensity />
      <PreferencesCopyTheme />
    </div>
  );
}
