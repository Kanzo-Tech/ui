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
    // `SectionNav` rendered `SidebarNav`'s tree from a different data shape. The only real
    // difference — per-item `isActive` versus a prefix-derived `activePath` — is now a prop.
    expect(surface.SectionNav).toBeUndefined();
    expect(UI.SidebarNav).toBeTypeOf("function");
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
      "menuContentVariants",
      "numberInputControlVariants",
      "pinInputInputVariants",
      "sectionBodyVariants",
      "sectionHeaderVariants",
      "sectionTitleVariants",
      "shellAsideVariants",
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
