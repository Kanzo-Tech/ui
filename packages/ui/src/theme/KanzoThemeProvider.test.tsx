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
