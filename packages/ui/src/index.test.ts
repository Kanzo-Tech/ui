import { describe, expect, it } from "vitest";
import * as UI from "./index";

describe("@kanzo-tech/ui public surface", () => {
  it("exposes the core surface", () => {
    expect(UI.Button).toBeTypeOf("function");
    expect(UI.Preferences).toBeTypeOf("function");
    expect(UI.KanzoThemeProvider).toBeTypeOf("function");
    expect(UI.useKanzoTheme).toBeTypeOf("function");
    expect(UI.themeScript).toBeTypeOf("function");
  });

  it("exposes exactly one themer", () => {
    // KanzoTheme set the theme attributes on a wrapper <div>, so it could not theme Ark's
    // portaled overlays. Re-exporting it beside the real provider gave callers no way to tell
    // which was which — a repo-wide grep found zero JSX usages and one working provider.
    expect((UI as Record<string, unknown>).KanzoTheme).toBeUndefined();
  });

  it("keeps CodeMirror-backed components off the root barrel", () => {
    // They import @codemirror/*, an OPTIONAL peer. Re-exporting them here made the root entry
    // statically import CodeMirror, so `import { Button }` threw for anyone without it.
    // They live on @kanzo-tech/ui/editor.
    const surface = UI as Record<string, unknown>;
    expect(surface.CodeEditor).toBeUndefined();
    expect(surface.CompletionField).toBeUndefined();
  });
});
