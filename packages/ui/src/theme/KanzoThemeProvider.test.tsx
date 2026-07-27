import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AXES, DEFAULT_PREFS } from "@kanzo-tech/theme";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  KanzoThemeProvider,
  useKanzoTheme,
  type AppearanceController,
} from "./KanzoThemeProvider.js";

function Probe({ onValue }: { onValue: (v: ReturnType<typeof useKanzoTheme>) => void }) {
  onValue(useKanzoTheme());
  return null;
}

/**
 * The effect that writes the `data-*` attributes lists its dependencies field by field, because in
 * controlled mode `prefs` is a fresh literal on every render and depending on the object would
 * re-apply every attribute every time. The cost of that decision is that adding an axis to `AXES`
 * does not add it to the deps, and nothing complains: the axis works on first mount and then never
 * updates again. `data-palette` shipped that way for exactly one commit.
 */
describe("KanzoThemeProvider axis wiring", () => {
  const source = readFileSync(resolve(__dirname, "KanzoThemeProvider.tsx"), "utf8");

  it("watches every axis it claims to apply", () => {
    const deps = source.match(/\}, \[(prefs\.[\s\S]*?)\]\);/)?.[1] ?? "";
    expect(deps, "could not find the attribute effect's dependency list").not.toBe("");
    const missing = AXES.map(({ key }) => key).filter((key) => !deps.includes(`prefs.${key}`));
    expect(missing, `axes applied but never watched: ${missing.join(", ")}`).toEqual([]);
  });

  it("has a default for every axis, so the attribute can be removed at it", () => {
    for (const { key, def } of AXES) expect(String(DEFAULT_PREFS[key]), key).toBe(def);
  });
});

describe("KanzoThemeProvider appearance (host controller path)", () => {
  it("splits preference from resolved when the host reports `system` + `dark`", () => {
    const controller: AppearanceController = {
      theme: "system",
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    expect(ctx?.appearance).toBe("system");
    expect(ctx?.resolvedAppearance).toBe("dark");
  });

  it("degrades to 2-state when the host wired only `resolvedTheme`", () => {
    const controller: AppearanceController = {
      resolvedTheme: "dark",
      setTheme: vi.fn(),
    };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    expect(ctx?.appearance).toBe("dark");
    expect(ctx?.resolvedAppearance).toBe("dark");
  });

  it("forwards setAppearance (incl. `system`) to the host's setTheme", () => {
    const setTheme = vi.fn();
    const controller: AppearanceController = { theme: "light", resolvedTheme: "light", setTheme };
    let ctx: ReturnType<typeof useKanzoTheme> | undefined;
    render(
      <KanzoThemeProvider appearance={controller}>
        <Probe onValue={(v) => (ctx = v)} />
      </KanzoThemeProvider>,
    );

    ctx?.setAppearance("system");
    expect(setTheme).toHaveBeenCalledWith("system");
  });
});
