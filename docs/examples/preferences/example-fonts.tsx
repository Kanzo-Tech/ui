import {
  PreferencesBase,
  PreferencesCopyTheme,
  PreferencesFont,
  PreferencesMonoFont,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-80 flex-col gap-6 rounded-lg border bg-popover p-5">
      <PreferencesFont />
      <PreferencesMonoFont />
      <PreferencesBase />
      <PreferencesCopyTheme />
    </div>
  );
}
