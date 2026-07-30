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
  ResolvedAppearance,
  KanzoRadius,
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
  PreferencesField,
  // Never exported until now, which made the panel's own doc ("every section is exported flat")
  // false and left `PrefFieldSet` reachable only as an internal.
  PreferencesFieldSet,
  // No `PreferencesAppearance`: appearance has ONE control, `AppearanceToggle`, which cycles all
  // three states in the chrome. A panel section was the same preference wearing a second control.
  PreferencesRadius,
  PreferencesFont,
  PreferencesMonoFont,
  PreferencesDensity,
} from "./composites/Preferences.js";
export type { PreferencesProps, PreferencesRootProps } from "./composites/Preferences.js";
export { AppearanceToggle } from "./composites/AppearanceToggle.js";
export type { AppearanceToggleProps, AppearanceToggleLabels } from "./composites/AppearanceToggle.js";

// ── Utilities ────────────────────────────────────────────────────────────────
export { cn } from "./lib/cn.js";

// Token colour, for any surface that paints from `--*` onto something CSS cannot reach — a canvas,
// a WebGL graph, a plot. Root barrel and not `/analytics`, because none of it imports an engine:
// the placement rule is "a part belongs on a subpath only if it imports that subpath's engine", and
// this used to fail it in the direction that costs the most — a graph installing DuckDB and Mosaic
// for twelve lines of arithmetic. `resolveTokenColor` and `useThemeTick` are a pair: resolve the
// token against the live element, and do it again when the theme moves.
export {
  CHART_SLOTS,
  categoricalCapacity,
  categoricalColor,
  resolveTokenColor,
} from "./lib/token-color.js";
export { useChartCapacity, useThemeTick } from "./lib/theme-tick.js";

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
export * from "./simples/accordion.js";
export * from "./simples/action-bar.js";
export * from "./simples/alert.js";
export * from "./simples/alert-dialog.js";
export * from "./simples/avatar.js";
export * from "./simples/badge.js";
export * from "./simples/breadcrumb.js";
export * from "./simples/button.js";
export * from "./simples/button-group.js";
export * from "./simples/calendar.js";
export * from "./simples/card.js";
export * from "./simples/checkbox.js";
export * from "./simples/client-only.js";
export * from "./simples/clipboard.js";
export * from "./simples/download-trigger.js";
export * from "./simples/color-picker.js";
export * from "./simples/collapsible.js";
export * from "./simples/combobox.js";
export * from "./simples/command.js";
export * from "./simples/date-picker.js";
export * from "./simples/dialog.js";
export * from "./simples/editable.js";
export * from "./simples/field.js";
export * from "./simples/file-upload.js";
export * from "./simples/float.js";
export * from "./simples/floating-panel.js";
export * from "./simples/highlight.js";
export * from "./simples/hover-card.js";
export * from "./simples/input.js";
export * from "./simples/input-group.js";
export * from "./simples/item.js";
export * from "./simples/json-tree-view.js";
export * from "./simples/kbd.js";
export * from "./simples/listbox.js";
export * from "./simples/menu.js";
export * from "./simples/native-select.js";
export * from "./simples/number-input.js";
export * from "./simples/pagination.js";
export * from "./simples/password-input.js";
export * from "./simples/pin-input.js";
export * from "./simples/popover.js";
export * from "./simples/progress.js";
export * from "./simples/prose.js";
export * from "./simples/radio-group.js";
export * from "./simples/rating.js";
export * from "./simples/segment-group.js";
export * from "./simples/resizable.js";
export * from "./simples/scroll-area.js";
export * from "./simples/select.js";
export * from "./simples/sheet.js";
export * from "./simples/separator.js";
export * from "./simples/show.js";
export * from "./simples/skeleton.js";
export * from "./simples/slider.js";
export * from "./simples/spinner.js";
export * from "./simples/stat-tile.js";
export * from "./simples/swatch.js";
export * from "./simples/status.js";
export * from "./simples/steps.js";
export * from "./simples/switch.js";
export * from "./simples/table.js";
export * from "./simples/tabs.js";
export * from "./simples/tags-input.js";
export * from "./simples/textarea.js";
export * from "./simples/toast.js";
export * from "./simples/toggle.js";
export * from "./simples/toggle-group.js";
export * from "./simples/tooltip.js";
export * from "./simples/tour.js";
export * from "./simples/tree-view.js";
export * from "./simples/complete.js";
export * from "./simples/suggest.js";
export * from "./simples/use-ai.js";

// ── Level 1 — bespoke atoms (no Shark equivalent; token-native, ours) ────────
export { DateField } from "./simples/DateField.js";
export type { DateFieldProps } from "./simples/DateField.js";
export { EmptyState } from "./simples/EmptyState.js";
export type { EmptyStateProps } from "./simples/EmptyState.js";
// GhostEditor / CodeEditor deliberately live ONLY on the `/editor` subpath: they import
// @codemirror/*, which is an OPTIONAL peer. Re-exporting them here made the root barrel
// statically import CodeMirror, so `import { Button } from "@kanzo-tech/ui"` failed outright
// for every consumer that had not installed it. Do not add them back.
export { Link } from "./simples/Link.js";
export type { LinkProps } from "./simples/Link.js";
export { TextField, NumberField } from "./simples/TextField.js";
export type { TextFieldProps, NumberFieldProps } from "./simples/TextField.js";
export type { Suggestion } from "./simples/types.js";
export { FieldArray } from "./simples/FieldArray.js";
export type { FieldArrayProps } from "./simples/FieldArray.js";
// No `CardRadioGroup`. A card radio is `RadioGroupCard` — `radio-group.tsx`'s own item styled off
// `data-[state=checked]`, which is rung 1 of the ladder and was already built. The monolith added a
// grid and an `options: CardRadioOption[]` array over it: a layout tree written as an attribute,
// which is the shape `SidebarIdentity` argues against in writing. The grid moved to the primitive.
export { Ribbon } from "./simples/Ribbon.js";
export type { RibbonProps } from "./simples/Ribbon.js";
// The one surface behind every facet filter. Lives in the root barrel because both consumers
// are on subpaths that must not see each other: `/table` would drag in Mosaic, `/analytics`
// would drag in TanStack. It is presentational, so it needs neither.
export { FacetFilter } from "./simples/FacetFilter.js";
export type { FacetFilterProps, FacetFilterItem } from "./simples/FacetFilter.js";

// ── Level 2 — composites (domain-free, token-native; sourced from keasy) ──────
// No `LinkComponent` / `DefaultLink`. They were the routing seam for five composites that took a
// trail, a menu or a nav as an array prop; all five are gone, and the seam a hand-composed nav uses
// is `asChild` on the part that renders the anchor — which reaches every part, not the one the prop
// was wired to. `DefaultLink` was also a second component emitting `data-slot="link"`, against
// `Link`, which is the styled one.
export {
  ShellRoot,
  ShellHeader,
  ShellBody,
  ShellAside,
  ShellMain,
  ShellFooter,
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
} from "./layouts/section.js";
export type {
  SectionRootProps,
  SectionHeaderProps,
  SectionTitleProps,
  SectionBodyProps,
} from "./layouts/section.js";
export * from "./composites/sidebar.js";
export {
  SidebarIdentity,
  SidebarIdentityAvatar,
  SidebarIdentityDescription,
  SidebarIdentityIcon,
  SidebarIdentityLabel,
  SidebarIdentityText,
} from "./composites/SidebarIdentity.js";
export type { SidebarIdentityProps } from "./composites/SidebarIdentity.js";
// The one piece of a navigation column that is logic rather than markup. The column itself is
// composed from `SidebarMenu*` — see the note on the deleted composites below.
export { isActivePath } from "./lib/is-active-path.js";
// No `SidebarNav`, `SidebarUser`, `InstanceSwitcher`, `Breadcrumbs` or `MadeWith`.
//
// Each took its layout tree as an array or record of `ReactNode`s — a shape you cannot reorder,
// wrap, spread a prop onto, or `asChild`. `SidebarIdentity`'s own doc comment above argues the case
// in full, and two of the five handed their record straight back into `SidebarIdentity`.
// `SidebarUser` and `InstanceSwitcher` were additionally the same component under two names, down
// to a byte-identical chevron and copy-pasted justification comments; `Breadcrumbs` had to invent
// `BreadcrumbEntry` because `BreadcrumbItem` was taken, which is a component arguing against
// itself; and `MadeWith` hard-coded English *and* the brand name "Kanzo" in a library whose first
// admission rule is domain-freedom.
//
// What each one did survives: the parts are all exported, `Breadcrumb` now carries the `min-w-0`
// that only the composite had, and the prefix-match above is the trap nobody should re-derive.

// ── Level 2 — shells / patterns (domain-free composites) ─────────────────────
// CodeEditor → `@kanzo-tech/ui/editor` (see the GhostEditor note above).
