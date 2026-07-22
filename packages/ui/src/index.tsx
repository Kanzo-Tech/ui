// @kanzo-tech/ui — the shared design-system surface.
//
// Level 1 (simples) are Shark UI components, vendored as-is (the shadcn-style
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
export * from "./simples/action-bar.js";
export * from "./simples/alert.js";
export * from "./simples/alert-dialog.js";
export * from "./simples/avatar.js";
export * from "./simples/badge.js";
export * from "./simples/breadcrumb.js";
export * from "./simples/button.js";
export * from "./simples/calendar.js";
export * from "./simples/card.js";
export * from "./simples/checkbox.js";
export * from "./simples/color-picker.js";
export * from "./simples/collapsible.js";
export * from "./simples/combobox.js";
export * from "./simples/command.js";
export * from "./simples/date-picker.js";
export * from "./simples/dialog.js";
export * from "./simples/field.js";
export * from "./simples/hover-card.js";
export * from "./simples/input.js";
export * from "./simples/input-group.js";
export * from "./simples/kbd.js";
export * from "./simples/menu.js";
export * from "./simples/native-select.js";
export * from "./simples/password-input.js";
export * from "./simples/context-menu.js";
export * from "./simples/popover.js";
export * from "./simples/progress.js";
export * from "./simples/radio-group.js";
export * from "./simples/segment-group.js";
export * from "./simples/resizable.js";
export * from "./simples/scroll-area.js";
export * from "./simples/select.js";
export * from "./simples/sheet.js";
export * from "./simples/separator.js";
export * from "./simples/skeleton.js";
export * from "./simples/slider.js";
export * from "./simples/spinner.js";
export * from "./simples/status.js";
export * from "./simples/steps.js";
export * from "./simples/switch.js";
export * from "./simples/table.js";
export * from "./simples/tabs.js";
export * from "./simples/textarea.js";
export * from "./simples/toast.js";
export * from "./simples/toggle.js";
export * from "./simples/toggle-group.js";
export * from "./simples/tooltip.js";
export * from "./simples/tour.js";
export * from "./simples/tree-view.js";

// ── Level 1 — bespoke atoms (no Shark equivalent; token-native, ours) ────────
export { DateField } from "./simples/DateField.js";
export type { DateFieldProps } from "./simples/DateField.js";
export { EmptyState } from "./simples/EmptyState.js";
export type { EmptyStateProps } from "./simples/EmptyState.js";
// GhostEditor / CodeEditor deliberately live ONLY on the `/editor` subpath: they import
// @codemirror/*, which is an OPTIONAL peer. Re-exporting them here made the root barrel
// statically import CodeMirror, so `import { Button } from "@kanzo-tech/ui"` failed outright
// for every consumer that had not installed it. Do not add them back.
export { Heading } from "./simples/Heading.js";
export type { HeadingProps } from "./simples/Heading.js";
export { Link } from "./simples/Link.js";
export type { LinkProps } from "./simples/Link.js";
export { Text } from "./simples/Text.js";
export type { TextProps } from "./simples/Text.js";
export { TextField, NumberField } from "./simples/TextField.js";
export type { TextFieldProps, NumberFieldProps } from "./simples/TextField.js";
export { SuggestMenu } from "./simples/SuggestMenu.js";
export type { Suggestion } from "./simples/types.js";
export { SecretField } from "./simples/SecretField.js";
export type { SecretFieldProps } from "./simples/SecretField.js";
export { FieldArray } from "./simples/FieldArray.js";
export type { FieldArrayProps } from "./simples/FieldArray.js";
export { CardRadioGroup } from "./simples/CardRadioGroup.js";
export type {
  CardRadioGroupProps,
  CardRadioOption,
} from "./simples/CardRadioGroup.js";
export { ComingSoon } from "./simples/ComingSoon.js";
export type { ComingSoonProps } from "./simples/ComingSoon.js";

// ── Level 2 — composites (domain-free, token-native; sourced from keasy) ──────
export type { LinkComponent } from "./composites/link.js";
export { DefaultLink } from "./composites/link.js";
export {
  ShellRoot,
  ShellHeader,
  ShellBody,
  ShellAside,
  ShellMain,
  ShellFooter,
  shellAsideVariants,
} from "./layouts/shell.js";
export type { ShellAsideProps } from "./layouts/shell.js";
export {
  SectionRoot,
  SectionHeader,
  SectionIcon,
  SectionTitleGroup,
  SectionTitle,
  SectionDescription,
  SectionActions,
  SectionBody,
  SectionFooter,
  sectionHeaderVariants,
  sectionTitleVariants,
  sectionBodyVariants,
} from "./layouts/section.js";
export type {
  SectionRootProps,
  SectionHeaderProps,
  SectionTitleProps,
  SectionBodyProps,
} from "./layouts/section.js";
export {
  StatCard,
  StatCardDescription,
  StatCardHeader,
  StatCardIcon,
  StatCardLabel,
  StatCardValue,
} from "./composites/StatCard.js";
export type {
  StatCardProps,
  StatCardStatus,
  StatCardValueProps,
  StatCardDescriptionProps,
} from "./composites/StatCard.js";
export { MadeWithKanzo } from "./composites/MadeWithKanzo.js";
export type { MadeWithKanzoProps } from "./composites/MadeWithKanzo.js";
export { Breadcrumbs } from "./composites/Breadcrumbs.js";
export type {
  BreadcrumbsProps,
  BreadcrumbEntry,
} from "./composites/Breadcrumbs.js";
export * from "./composites/sidebar.js";
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
export {
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "./composites/SidebarIdentity.js";
export type { SidebarIdentityProps } from "./composites/SidebarIdentity.js";
export { SectionNav } from "./composites/SectionNav.js";
export type { SectionNavProps, NavSection } from "./composites/SectionNav.js";

// ── Level 2 — shells / patterns (domain-free composites) ─────────────────────
// CodeEditor → `@kanzo-tech/ui/editor` (see the GhostEditor note above).
