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
  });

  it("exposes the one facet-filter surface, on the root barrel", () => {
    // Both consumers sit on subpaths that must not import each other — `/table` would pull in
    // Mosaic, `/analytics` would pull in TanStack. FacetFilter is presentational, so the root
    // barrel is the only place it can serve both. It is built on `Listbox`, not on `Menu`:
    // a filter is a value, so its surface is a listbox (DESIGN.md, admission rules).
    expect(UI.FacetFilter).toBeTypeOf("function");
    expect(UI.ListboxItem).toBeTypeOf("function");
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
