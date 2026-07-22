import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "../simples/toggle-group.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import { ShellBar, ShellBarEnd, ShellBarStart } from "./shell.js";

/**
 * `ShellBar` itself is presentational and has nothing to assert beyond its slots. What is
 * worth a test is the composition it replaced: `StatusBar` used to own a `panels` prop and
 * render the toggle cluster itself, so the roving-focus contract lived inside the component.
 * Now the consumer composes a `ToggleGroup` inside `ShellBarEnd` — which means the knowledge
 * about HOW to compose it correctly has to be guarded here, or it is lost.
 *
 * The load-bearing part is the nesting order, and nobody would guess it: `ToggleGroupItem`
 * must be OUTER and the tooltip trigger its `asChild`. In an `asChild` chain the outer
 * component's props win, and zag finds a group's items by querying
 * `[data-scope=toggle-group][data-part=item]`. Invert the nesting and the tooltip overwrites
 * both attributes, zag collects zero items, and roving focus dies with no error anywhere.
 */

const panels = [
  { id: "files", label: "Files" },
  { id: "search", label: "Search" },
  { id: "git", label: "Source control" },
];

function StatusStrip({ active = "files" }: { active?: string }) {
  return (
    <ShellBar aria-label="Status" position="bottom" role="contentinfo" size="sm">
      <ShellBarStart>Ready</ShellBarStart>
      <ShellBarEnd>
        <ToggleGroup aria-label="Panels" multiple value={[active]}>
          {panels.map(({ id, label }) => (
            <Tooltip key={id} positioning={{ placement: "top" }}>
              <ToggleGroupItem aria-label={label} asChild value={id}>
                <TooltipTrigger>
                  <svg aria-hidden />
                </TooltipTrigger>
              </ToggleGroupItem>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </ShellBarEnd>
    </ShellBar>
  );
}

const active = () => (document.activeElement as HTMLElement | null)?.getAttribute("aria-label");

describe("ShellBar", () => {
  it("declares no role of its own, so the call site owns the landmark", () => {
    render(
      <ShellBar>
        <ShellBarStart>Left</ShellBarStart>
      </ShellBar>,
    );

    // Not role="toolbar": a bar of arbitrary children cannot provide roving focus, and both
    // Toolbar and StatusBar used to claim that role without implementing it.
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("lets the call site declare a landmark when the bar genuinely is one", () => {
    render(<StatusStrip />);
    expect(screen.getByRole("contentinfo", { name: "Status" })).toBeTruthy();
  });

  it("carries data-position so a recipe can select on the edge", () => {
    render(<ShellBar position="bottom">bar</ShellBar>);
    expect(screen.getByText("bar").getAttribute("data-position")).toBe("bottom");
  });
});

describe("a ToggleGroup composed inside a ShellBar", () => {
  it("keeps the group's own scope/part attributes, so zag can collect the items", () => {
    render(<StatusStrip />);

    // Invert the Tooltip/ToggleGroupItem nesting and these become scope=tooltip /
    // part=trigger, and roving focus dies silently. This is the guard.
    const item = screen.getByRole("button", { name: "Files" });
    expect(item.getAttribute("data-scope")).toBe("toggle-group");
    expect(item.getAttribute("data-part")).toBe("item");
  });

  it("moves focus with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<StatusStrip />);

    screen.getByRole("button", { name: "Files" }).focus();

    // zag focuses inside a rAF, which jsdom runs on a timer — hence waitFor.
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(active()).toBe("Search"));

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(active()).toBe("Files"));
  });

  it("reports the pressed state through data-state", () => {
    render(<StatusStrip active="search" />);

    expect(screen.getByRole("button", { name: "Search" }).getAttribute("data-state")).toBe("on");
    expect(screen.getByRole("button", { name: "Files" }).getAttribute("data-state")).toBe("off");
  });
});
