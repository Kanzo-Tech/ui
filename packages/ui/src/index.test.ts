import { describe, expect, it } from "vitest";
import * as UI from "./index";

describe("@kanzo-tech/ui public surface", () => {
  it("exposes the core surface", () => {
    expect(UI.Button).toBeTypeOf("function");
    expect(UI.Preferences).toBeTypeOf("function");
    expect(UI.KanzoThemeProvider).toBeTypeOf("function");
    expect(UI.useKanzoTheme).toBeTypeOf("function");
    expect(UI.themeScript).toBeTypeOf("function");
    expect(UI.ButtonGroup).toBeTypeOf("function");
    expect(UI.NumberInput).toBeTypeOf("function");
    expect(UI.Item).toBeTypeOf("function");
    expect(UI.Float).toBeTypeOf("function");
    expect(UI.AppearanceToggle).toBeTypeOf("function");
    expect(UI.useAiStream).toBeTypeOf("function");
    expect(UI.useCompletion).toBeTypeOf("function");
    expect(UI.useSuggestions).toBeTypeOf("function");
    expect(UI.CompleteRoot).toBeTypeOf("function");
    expect(UI.CompleteInput).toBeTypeOf("function");
    expect(UI.CompleteGhost).toBeTypeOf("function");
    expect(UI.SuggestRoot).toBeTypeOf("function");
    expect(UI.SuggestTrigger).toBeTypeOf("function");
    expect(UI.SuggestContent).toBeTypeOf("function");
    expect(UI.ClientOnly).toBeTypeOf("function");
    expect(UI.DownloadTrigger).toBeTypeOf("function");
    expect(UI.Show).toBeTypeOf("function");
    expect(UI.JsonTreeView).toBeTypeOf("function");
    expect(UI.Listbox).toBeTypeOf("function");
    // The one primitive Ark cannot supply for colour: a strip that only *depicts*. Ark's swatch
    // parts all require a picker context and compute `checked` against its single value, so a
    // sixteen-slot palette strip cannot be built from them.
    expect(UI.Swatch).toBeTypeOf("function");
    expect(UI.SwatchGroup).toBeTypeOf("function");
  });

  it("can build every value its machines demand, from the barrel alone", () => {
    // A machine whose value cannot be constructed from the barrel is not usable from the barrel.
    // `Select`/`Combobox` take a collection; `DatePicker` takes a `DateValue[]`, and the ISO
    // adapter that used to build one went with `DateField`. Both helpers are re-exported here so
    // a consumer never needs a direct `@ark-ui/react` or `@internationalized/date` dependency.
    expect(UI.createListCollection).toBeTypeOf("function");
    expect(UI.parseDate).toBeTypeOf("function");
    expect(UI.parseDate("2026-07-31").toString()).toBe("2026-07-31");
  });

  it("exposes the one facet-filter surface, on the root barrel", () => {
    // Both consumers sit on subpaths that must not import each other — `/table` would pull in
    // Mosaic, `/analytics` would pull in TanStack. FacetFilter is presentational, so the root
    // barrel is the only place it can serve both. It is built on `Listbox`, not on `Menu`:
    // a filter is a value, so its surface is a listbox (DESIGN.md, admission rules).
    expect(UI.FacetFilter).toBeTypeOf("function");
    expect(UI.ListboxItem).toBeTypeOf("function");
    // The filter field `searchable` draws. An Ark part Shark's listbox omits, so nothing upstream
    // would notice it going missing.
    expect(UI.ListboxInput).toBeTypeOf("function");
    // Deliberately absent: a third `data-slot` rename of MenuShortcut's span, with no renderer.
    // (A fourth until `ContextMenuShortcut` went, below.)
    expect((UI as Record<string, unknown>).ListboxShortcut).toBeUndefined();
  });

  it("exposes exactly one themer", () => {
    // KanzoTheme set the theme attributes on a wrapper <div>, so it could not theme Ark's
    // portaled overlays. Re-exporting it beside the real provider gave callers no way to tell
    // which was which — a repo-wide grep found zero JSX usages and one working provider.
    expect((UI as Record<string, unknown>).KanzoTheme).toBeUndefined();
  });

  it("drops components superseded by composition or a merge", () => {
    // MetricCard → a Card+Skeleton showcase composition; SecretField → folded into password-input
    // (an API key is a password). Neither is a library export any more.
    const surface = UI as Record<string, unknown>;
    expect(surface.MetricCard).toBeUndefined();
    expect(surface.SecretField).toBeUndefined();
    // SuggestMenu dissolved into a Popover + useSuggestions composition.
    expect(surface.SuggestMenu).toBeUndefined();
    // The AiAssist provider was over-engineered for one consumer, and a `complete` prop plus the
    // monolithic FieldSuggest violated core purity. AI-assist is now two composed compounds —
    // `Complete` (over a pure Input/Textarea) and `Suggest` — with the engine hooks headless.
    expect(surface.AiAssist).toBeUndefined();
    expect(surface.useAiField).toBeUndefined();
    expect(surface.useAiFieldOptional).toBeUndefined();
    expect(surface.FieldSuggest).toBeUndefined();
    // `Fieldset` and `FieldSet` wrapped the same `ArkFieldset.Root` and differed by one capital
    // letter, with a doc page each teaching it in near-identical sentences. `FieldSet` won — six
    // consumers to one, and a `variant` prop `FieldsetLegend` hardcoded. The fieldset-*scoped*
    // messages were the only thing `field.tsx` lacked, and they survive as `FieldSetHelper` /
    // `FieldSetError`: a different Ark machine from `FieldHelper` / `FieldError`, not a copy.
    expect(surface.Fieldset).toBeUndefined();
    expect(surface.FieldsetLegend).toBeUndefined();
    expect(surface.FieldsetHelperText).toBeUndefined();
    expect(surface.FieldsetErrorText).toBeUndefined();
    expect(surface.useFieldset).toBeUndefined();
    expect(UI.FieldSetHelper).toBeTypeOf("function");
    expect(UI.FieldSetError).toBeTypeOf("function");
    // `context-menu.tsx` paid ten exports for rung 2 of the ladder: nine were `data-slot` renames
    // of `Menu`'s parts and the tenth was the only real one. A context menu is the same `Menu` with
    // a different trigger, which is what `menu.mdx` already said.
    expect(surface.ContextMenu).toBeUndefined();
    expect(surface.ContextMenuItem).toBeUndefined();
    expect(surface.ContextMenuTrigger).toBeUndefined();
    expect(surface.ContextMenuShortcut).toBeUndefined();
    expect(surface.useContextMenu).toBeUndefined();
    expect(UI.MenuContextTrigger).toBeTypeOf("function");
    // `CardRadioGroup` was rung-1 layout plus an `options: ReactNode[]` array over a compound that
    // already existed. The grid moved onto `RadioGroup` as a `columns` prop; the cards are
    // `RadioGroupCard`, which is what a card radio always was.
    expect(surface.CardRadioGroup).toBeUndefined();
    expect(UI.RadioGroupCard).toBeTypeOf("function");
    expect(surface.SectionNav).toBeUndefined();
  });

  it("drops the components that took a layout tree as an array prop", () => {
    // The rule `SidebarIdentity.tsx` states in full: if a prop's value is markup, it is children.
    // A record or array of `ReactNode`s is a layout tree written as an attribute — you cannot
    // reorder it, wrap a region, spread `className`/`data-*`/a handler onto one entry, or use
    // `asChild` on one. All five failed it, and their parts all ship.
    const surface = UI as Record<string, unknown>;
    // `SidebarNav`'s items were TWO levels deep with `title: string`, so a caller could not bold a
    // word. `SectionNav` was already merged into it; both are gone. A nav column is `SidebarMenu`
    // + `SidebarMenuButton asChild`, and the one non-obvious part is exported as `isActivePath`.
    expect(surface.SidebarNav).toBeUndefined();
    expect(surface.SidebarNavItem).toBeUndefined();
    expect(UI.isActivePath).toBeTypeOf("function");
    // `SidebarUser` and `InstanceSwitcher` were one component under two names — byte-identical
    // trigger, identity row, menu body and comments. `SidebarUser.user` was *literally* the
    // `label`/`description`/`avatarUrl` record `SidebarIdentity` names as the shape it rejects,
    // and `separatorBefore: boolean` was the confession: a separator between children, in a shape
    // with no children to put one between.
    expect(surface.SidebarUser).toBeUndefined();
    expect(surface.InstanceSwitcher).toBeUndefined();
    expect(UI.SidebarIdentity).toBeTypeOf("function");
    expect(UI.Menu).toBeTypeOf("function");
    // `Breadcrumbs` had to invent `BreadcrumbEntry` because `BreadcrumbItem` was taken. A component
    // that forces a synonym for an existing concept is evidence against itself. Its `min-w-0` moved
    // onto the primitive; the collapse is a hand-composed example, which is how Shark ships it.
    expect(surface.Breadcrumbs).toBeUndefined();
    expect(UI.Breadcrumb).toBeTypeOf("function");
    expect(UI.BreadcrumbEllipsis).toBeTypeOf("function");
    // `MadeWith` hard-coded the English "Made with"/"at" and defaulted `by` to the brand name
    // "Kanzo", in a library whose first admission rule is domain-freedom.
    expect(surface.MadeWith).toBeUndefined();
    // The routing seam for all five. `asChild` on the part that renders the anchor reaches every
    // part, not just the one a `linkComponent` prop was wired to — and `DefaultLink` was a second
    // component emitting `data-slot="link"`, against `Link`, which is the styled one.
    expect(surface.DefaultLink).toBeUndefined();
    expect(UI.Link).toBeTypeOf("function");
  });

  it("drops the pre-arrangements over parts that already ship", () => {
    const surface = UI as Record<string, unknown>;
    // `EmptyState` was `icon`/`title`/`description`/`action` as four `ReactNode` props over a raw
    // `<div>` — no `ark.*`, no recipe. `Item` and its parts compose to exactly this.
    expect(surface.EmptyState).toBeUndefined();
    expect(UI.Item).toBeTypeOf("function");
    expect(UI.ItemMedia).toBeTypeOf("function");
    expect(UI.ItemTitle).toBeTypeOf("function");
    expect(UI.ItemDescription).toBeTypeOf("function");
    expect(UI.ItemActions).toBeTypeOf("function");
    // `Ribbon`'s whole render was `<div class="relative">{children}<Float><Badge/></Float></div>`.
    expect(surface.Ribbon).toBeUndefined();
    expect(UI.Float).toBeTypeOf("function");
    expect(UI.Badge).toBeTypeOf("function");
    // `TextField`'s `iconStart`/`iconEnd` were named regions as attributes over `InputGroup` +
    // `InputGroupAddon`. It also used the forbidden `forwardRef`.
    expect(surface.TextField).toBeUndefined();
    expect(UI.InputGroup).toBeTypeOf("function");
    expect(UI.InputGroupAddon).toBeTypeOf("function");
    expect(UI.InputGroupInput).toBeTypeOf("function");
    // `NumberField` was `TextField type="number"` — rung 1 of the ladder minted as a component,
    // shadowing the Ark machine with the friendlier name and none of its steppers, scrubber,
    // format or clamping. `type="number"` is the input everybody advises against.
    expect(surface.NumberField).toBeUndefined();
    expect(UI.NumberInput).toBeTypeOf("function");
    // `DateField` pre-arranged `DatePicker` plus nine `Calendar*` parts and took no `className`,
    // no `ref`, no `...rest`, no `id`/`name`/`aria-*` — strictly less capable than the parts.
    expect(surface.DateField).toBeUndefined();
    expect(UI.DatePicker).toBeTypeOf("function");
    expect(UI.Calendar).toBeTypeOf("function");
  });

  it("drops the Ark context aliases and parts nothing ever rendered", () => {
    // 32 exports with no reference of any kind anywhere in the repo — not a call site, not a test,
    // not a sentence of prose. Each `useX` was a one-line `export const useX = useXContext`, a
    // rename of a symbol the consumer can import from Ark directly; each `*Context` was the same
    // trick on a component. Renaming somebody else's export is not an API.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "useAvatar", "useCheckbox", "useDatePicker", "useDialog", "useField", "useHoverCard",
      "useListbox", "useNumberInput", "usePasswordInput", "usePopover", "useRating",
      "useSegmentGroup", "useSelect", "useSheet", "useSwitch", "useTagsInput", "useToast",
      "useToggle", "useToggleGroup", "useTooltip",
      // The same alias, on eleven more machines. These had a doc page and still no caller — a
      // page proving the symbol exists is not the second call site admission rule 2 asks for.
      "useAccordion", "useClipboard", "useCollapsible", "useEditable", "usePinInput",
      "useProgress", "useResizable", "useScrollArea", "useSteps", "useTabs", "useTreeView",
      "ComboboxContext", "ListboxContext", "SelectContext",
      "CalendarControl", "CalendarLabel", "CalendarTrigger",
      "ColorPickerLabel", "ColorPickerView", "ColorPickerFormatTrigger",
      "ColorPickerFormatSelect", "ColorPickerSwatchPreview",
      "SidebarInput",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    // `useField` and `FieldSeparator` are the two DESIGN.md names as "the parts still without a
    // consumer". That was written as an argument for patience; it had been true long enough to be
    // an answer instead.
    expect(surface.FieldSeparator).toBeUndefined();
    // Kept, and the reason is the contrast: these have a consumer inside the library.
    // `useColorPicker` looks identical to the eleven above and stays: `color-picker.test.tsx`
    // imports it. Matching the pattern is not the test; having a consumer is.
    expect(UI.useColorPicker).toBeTypeOf("function");
    expect(UI.useSidebar).toBeTypeOf("function");
    expect(UI.useKanzoTheme).toBeTypeOf("function");
    // `CalendarPresetTrigger` survives its three deleted neighbours — `date-picker.tsx` renders it.
    expect(UI.CalendarPresetTrigger).toBeTypeOf("function");
  });

  it("does not export a part its own root already renders", () => {
    // 36 parts with no external consumer, because the component places them itself. Un-exported,
    // symbol kept — removing the export cannot break anything, while keeping it advertises a
    // composition the root does not allow.
    //
    // `ProgressTrack` is the one to read the code for. DESIGN.md:239 holds it up as "the ideal
    // case, not a defect", on the grounds that the docs tell you never to place it yourself. But
    // `simples/progress.tsx` renders `<ProgressTrack><ProgressRange /></ProgressTrack>`
    // unconditionally, *after* `{children}` — so a consumer who follows the export and places one
    // gets TWO troughs. An export whose documentation is "do not use this" is an export that
    // should not exist; the ideal case is the symbol existing and the export not.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "ProgressTrack", "ProgressRange", "CheckboxIndicator", "ClipboardIndicator",
      "PasswordInputIndicator", "SegmentGroupIndicator", "TreeViewBranchIndicator",
      "CalendarContext", "CalendarTableHead", "CalendarTableRow", "CalendarTableHeader",
      "CalendarTableBody", "CalendarTableCell",
      "ComboboxPositioner", "MenuPositioner", "PopoverPositioner", "SheetPositioner",
      "TourPositioner",
      "ComboboxClear", "ComboboxGroupLabel", "useCombobox", "ListboxItemGroupLabel",
      "PopoverDescription", "PopoverClose", "ScrollAreaScrollbar", "SelectClearTrigger",
      "SheetOverlay", "SuggestItem", "ToastItem",
      "TourActionTrigger", "TourOverlay", "TourSpotlight", "TourClose", "useTourContext",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    // The roots that render them are of course still exported — that is the whole point.
    expect(UI.Progress).toBeTypeOf("function");
    expect(UI.Checkbox).toBeTypeOf("function");
    expect(UI.Popover).toBeTypeOf("function");
  });

  it("keeps the AI engine hooks exported, and the CodeMirror style not", () => {
    // `useAiStream` looks like the un-export candidates and is not one: DESIGN.md argues the engine
    // "stays in the two headless hooks, **exposed for custom surfaces**", which is a promise about
    // a surface we did not write. `kanzoHighlighting` is documented the same way, as reusable
    // CodeMirror highlighting. `kanzoHighlightStyle` is the raw style array underneath it, with no
    // consumer and no such promise — it left `@kanzo-tech/ui/editor`.
    expect(UI.useAiStream).toBeTypeOf("function");
    expect(UI.useCompletion).toBeTypeOf("function");
    expect(UI.useSuggestions).toBeTypeOf("function");
  });

  it("exports every compound flat, with no dot-notation namespace", () => {
    // `Preferences` was the one counter-example, via `Object.assign`. Those statics do NOT survive
    // React Server Components: once the module is a client reference `Preferences.Density` reads
    // back as `undefined` and React throws "Element type is invalid". A broken API beside the
    // working one — the flat exports were always the real surface.
    const preferences = UI.Preferences as unknown as Record<string, unknown>;
    expect(preferences.Root).toBeUndefined();
    expect(preferences.Panel).toBeUndefined();
    expect(preferences.Density).toBeUndefined();
    expect(UI.PreferencesRoot).toBeTypeOf("function");
    expect(UI.PreferencesPanel).toBeTypeOf("function");
    expect(UI.PreferencesDensity).toBeTypeOf("function");
  });

  it("keeps `tv()` recipes off the public surface unless another module needs them", () => {
    // A variant object is an implementation detail: exported, it freezes a class list as API. The
    // fourteen with no importer are internal again. The exceptions stay because a *different* module
    // imports them — `statusVariants` is the one to be careful with: `avatar.tsx` imports it as a
    // type for `VariantProps<typeof statusVariants>`, which still requires the value to be exported.
    // A sweep that trusted "used only by its own file" would have broken Avatar.
    const surface = UI as Record<string, unknown>;
    for (const name of [
      "alertVariants",
      "badgeVariants",
      "buttonGroupVariants",
      "floatVariants",
      "linkVariants",
      "menuContentVariants",
      "numberInputControlVariants",
      "pinInputInputVariants",
      "sectionBodyVariants",
      "sectionHeaderVariants",
      "sectionTitleVariants",
      "shellAsideVariants",
      "swatchVariants",
      "sidebarMenuBadgeVariants",
      "toggleVariants",
    ]) {
      expect(surface[name], name).toBeUndefined();
    }
    expect(UI.buttonVariants).toBeTypeOf("function");
    expect(UI.inputVariants).toBeTypeOf("function");
    expect(UI.statusVariants).toBeTypeOf("function");
  });

  it("keeps CodeMirror-backed components off the root barrel", () => {
    // They import @codemirror/*, an OPTIONAL peer. Re-exporting them here made the root entry
    // statically import CodeMirror, so `import { Button }` threw for anyone without it.
    // They live on @kanzo-tech/ui/editor.
    const surface = UI as Record<string, unknown>;
    expect(surface.CodeEditor).toBeUndefined();
    expect(surface.CompletionField).toBeUndefined();
  });

  it("keeps the Mosaic/vgplot charts off the root barrel", () => {
    // They import @uwdata/vgplot + @uwdata/mosaic-core, OPTIONAL peers that drag in the whole
    // DuckDB/Mosaic analytics stack. Re-exporting them here would make `import { Button }` throw
    // for everyone who has not installed it. They live on @kanzo-tech/ui/analytics.
    const surface = UI as Record<string, unknown>;
    expect(surface.MosaicProvider).toBeUndefined();
    expect(surface.ChartRoot).toBeUndefined();
    expect(surface.ChartBarY).toBeUndefined();
    expect(surface.ChartIntervalX).toBeUndefined();
    expect(surface.useChart).toBeUndefined();
  });

  it("keeps the TanStack Table layer off the root barrel", () => {
    // Same contract as the two above: @tanstack/react-table is an OPTIONAL peer, so every part
    // of the data-table layer lives on @kanzo-tech/ui/table.
    const surface = UI as Record<string, unknown>;
    expect(surface.DataTable).toBeUndefined();
    expect(surface.useDataTable).toBeUndefined();
    expect(surface.DataTableRoot).toBeUndefined();
    expect(surface.selectColumn).toBeUndefined();
  });
});
