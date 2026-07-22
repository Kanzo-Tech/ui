// @kanzo-tech/ui — the shared design-system surface.
//
// Level 1 (primitives) are Shark UI components, vendored as-is (the shadcn-style
// registry model) and re-exported flat. Level 2 (composites / shells) are our
// domain-free patterns composed over them. Everything runs on Ark UI +
// tailwind-variants + tokens + tw-animate-css.
//
// Admission rule: nothing that knows about RDF / SHACL / fossil / graphs / auth.

// ── Theming (APPEARANCE) — KanzoThemeProvider + live Preferences selector ───
// There is exactly one provider: KanzoThemeProvider, below. It writes the theme attributes to
// <html>, which is the only place they reach Ark's portaled overlays (Dialog, Popover, Menu,
// Select, Tooltip…) — those render into document.body, outside any wrapper element.
export type {
  Appearance,
  KanzoBase,
  KanzoRadius,
  KanzoAccent,
  CuratedAccent,
  KanzoDensity,
  KanzoFont,
  KanzoMonoFont,
} from "@kanzo-tech/theme";
export { KanzoThemeProvider, useKanzoTheme, cookieStorageAdapter } from "./theme/KanzoThemeProvider.js";
export type {
  KanzoThemeProviderProps,
  ThemePrefs,
  FontOption,
  ThemeStorage,
  AppearanceController,
} from "./theme/KanzoThemeProvider.js";
// SSR anti-FOUC pre-hydration script (see ./theme/theme-script.ts for framework recipes).
export { themeScript } from "./theme/theme-script.js";
export type { ThemeScriptOptions } from "./theme/theme-script.js";
export {
  Preferences,
  // Flat parts — these survive the RSC client boundary; the `Preferences.X` statics do not.
  PreferencesRoot,
  PreferencesTrigger,
  PreferencesPanel,
  PreferencesAppearance,
  PreferencesAccent,
  PreferencesRadius,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesDensity,
  PreferencesBase,
  PreferencesCopyTheme,
} from "./composites/Preferences.js";
export type { PreferencesProps, PreferencesRootProps } from "./composites/Preferences.js";

// ── Utilities ────────────────────────────────────────────────────────────────
export { cn } from "./lib/cn.js";

// Ark collection helpers — required by consumers to build the `collection` that
// Select / Combobox demand (Ark's own list-collection utilities, surfaced here so
// downstreams don't need a direct @ark-ui/react dependency).
export {
  createListCollection,
  useListCollection,
} from "@ark-ui/react/collection";
export type { ListCollection, CollectionItem } from "@ark-ui/react/collection";
// `useFilter` completes the collection-filtering trio the `Command`/Combobox pattern needs.
export { useFilter } from "@ark-ui/react/locale";

// ── Level 1 — primitives (Shark UI, vendored as-is; flat compound API) ───────
export * from "./primitives/action-bar.js";
export * from "./primitives/alert.js";
export * from "./primitives/alert-dialog.js";
export * from "./primitives/avatar.js";
export * from "./primitives/badge.js";
export * from "./primitives/breadcrumb.js";
export * from "./primitives/button.js";
export * from "./primitives/calendar.js";
export * from "./primitives/card.js";
export * from "./primitives/checkbox.js";
export * from "./primitives/color-picker.js";
export * from "./primitives/collapsible.js";
export * from "./primitives/combobox.js";
export * from "./primitives/command.js";
export * from "./primitives/date-picker.js";
export * from "./primitives/dialog.js";
export * from "./primitives/field.js";
export * from "./primitives/hover-card.js";
export * from "./primitives/input.js";
export * from "./primitives/input-group.js";
export * from "./primitives/kbd.js";
export * from "./primitives/menu.js";
export * from "./primitives/native-select.js";
export * from "./primitives/password-input.js";
export * from "./primitives/context-menu.js";
export * from "./primitives/popover.js";
export * from "./primitives/progress.js";
export * from "./primitives/radio-group.js";
export * from "./primitives/segment-group.js";
export * from "./primitives/resizable.js";
export * from "./primitives/scroll-area.js";
export * from "./primitives/select.js";
export * from "./primitives/sheet.js";
export * from "./primitives/separator.js";
export * from "./primitives/skeleton.js";
export * from "./primitives/slider.js";
export * from "./primitives/spinner.js";
export * from "./primitives/status.js";
export * from "./primitives/steps.js";
export * from "./primitives/switch.js";
export * from "./primitives/table.js";
export * from "./primitives/tabs.js";
export * from "./primitives/textarea.js";
export * from "./primitives/toast.js";
export * from "./primitives/toggle.js";
export * from "./primitives/tooltip.js";
export * from "./primitives/tour.js";
export * from "./primitives/tree-view.js";

// ── Level 1 — bespoke atoms (no Shark equivalent; token-native, ours) ────────
export { DateField } from "./primitives/DateField.js";
export type { DateFieldProps } from "./primitives/DateField.js";
export { EmptyState } from "./primitives/EmptyState.js";
export type { EmptyStateProps } from "./primitives/EmptyState.js";
// GhostEditor / EditorShell deliberately live ONLY on the `/editor` subpath: they import
// @codemirror/*, which is an OPTIONAL peer. Re-exporting them here made the root barrel
// statically import CodeMirror, so `import { Button } from "@kanzo-tech/ui"` failed outright
// for every consumer that had not installed it. Do not add them back.
export { Heading } from "./primitives/Heading.js";
export type { HeadingProps } from "./primitives/Heading.js";
export { Link } from "./primitives/Link.js";
export type { LinkProps } from "./primitives/Link.js";
export { Text } from "./primitives/Text.js";
export type { TextProps } from "./primitives/Text.js";
export { TextField, NumberField } from "./primitives/TextField.js";
export type { TextFieldProps, NumberFieldProps } from "./primitives/TextField.js";
export { SuggestMenu } from "./primitives/SuggestMenu.js";
export type { Suggestion } from "./primitives/types.js";
export { SecretField } from "./primitives/SecretField.js";
export type { SecretFieldProps } from "./primitives/SecretField.js";
export { FieldArray } from "./primitives/FieldArray.js";
export type { FieldArrayProps } from "./primitives/FieldArray.js";
export { CardRadioGroup } from "./primitives/CardRadioGroup.js";
export type {
  CardRadioGroupProps,
  CardRadioOption,
} from "./primitives/CardRadioGroup.js";
export { ComingSoon } from "./primitives/ComingSoon.js";
export type { ComingSoonProps } from "./primitives/ComingSoon.js";

// ── Level 2 — composites (domain-free, token-native; sourced from keasy) ──────
export type { LinkComponent } from "./composites/link.js";
export { DefaultLink } from "./composites/link.js";
export { PageShell } from "./composites/PageShell.js";
export { Toolbar } from "./composites/Toolbar.js";
export type { ToolbarProps } from "./composites/Toolbar.js";
export { SectionHeader } from "./composites/SectionHeader.js";
export type { SectionHeaderProps } from "./composites/SectionHeader.js";
export { StatCard } from "./composites/StatCard.js";
export type { StatCardProps, StatCardStatus } from "./composites/StatCard.js";
export { MadeWithKanzo } from "./composites/MadeWithKanzo.js";
export type { MadeWithKanzoProps } from "./composites/MadeWithKanzo.js";
export { TwoPaneLayout } from "./composites/TwoPaneLayout.js";
export type { TwoPaneLayoutProps } from "./composites/TwoPaneLayout.js";
export { Breadcrumbs } from "./composites/Breadcrumbs.js";
export type {
  BreadcrumbsProps,
  BreadcrumbEntry,
} from "./composites/Breadcrumbs.js";
export * from "./primitives/sidebar.js";
export { SidebarNav } from "./composites/SidebarNav.js";
export type { SidebarNavProps, SidebarNavItem } from "./composites/SidebarNav.js";
export { SidebarUser } from "./composites/SidebarUser.js";
export type { SidebarUserProps, SidebarUserMenuItem } from "./composites/SidebarUser.js";
export { InstanceSwitcher } from "./composites/InstanceSwitcher.js";
export type {
  InstanceSwitcherProps,
  Instance,
  InstanceSwitcherAction,
} from "./composites/InstanceSwitcher.js";
export { SidebarIdentity } from "./composites/SidebarIdentity.js";
export type { IdentityData } from "./composites/SidebarIdentity.js";
export { SectionNav } from "./composites/SectionNav.js";
export type { SectionNavProps, NavSection } from "./composites/SectionNav.js";

// ── Level 2 — shells / patterns (domain-free composites) ─────────────────────
export { AppShell } from "./shells/AppShell.js";
export { TopBar } from "./shells/TopBar.js";
export { SidePanel } from "./shells/SidePanel.js";
// EditorShell → `@kanzo-tech/ui/editor` (see the GhostEditor note above).
export { StatusBar } from "./shells/StatusBar.js";
export type { StatusBarProps, StatusBarPanelButton } from "./shells/StatusBar.js";
export { WorkspaceLayout, PanelHeader, useWorkspacePanel } from "./shells/WorkspaceLayout.js";
export type { WorkspaceLayoutProps, PanelDef } from "./shells/WorkspaceLayout.js";
