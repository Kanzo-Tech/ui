import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ToggleGroup, ToggleGroupItem } from "../simples/toggle-group.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../simples/tooltip.js";
import {
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "./shell.js";

/**
 * The regions are structural and have nothing to assert beyond placement. What is worth a
 * test is the composition that replaced `StatusBar`: it used to own a `panels` prop and render
 * the toggle cluster itself, so the roving-focus contract lived inside the component. Now the
 * consumer composes a `ToggleGroup` inside a region — which means the knowledge about HOW to
 * compose it correctly has to be guarded here, or it is lost with the component.
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
    // The IDE density (h-[1.625rem], the small font) is the CALLER's, applied here as
    // ordinary classes. The region itself has no aesthetic.
    <ShellFooter
      aria-label="Status"
      className="h-[1.625rem] flex-row items-center gap-2 bg-card px-1.5 text-[11px] text-muted-foreground"
      role="contentinfo"
    >
      <span className="min-w-0 flex-1">Ready</span>
      <div className="flex shrink-0 items-center">
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
      </div>
    </ShellFooter>
  );
}

const active = () => (document.activeElement as HTMLElement | null)?.getAttribute("aria-label");

describe("the header and footer regions", () => {
  it("declare no role, so the call site owns the landmark", () => {
    render(<ShellHeader>chrome</ShellHeader>);

    // Not role="toolbar": a region of arbitrary children cannot provide roving focus, and
    // both Toolbar and StatusBar used to claim that role without implementing it. Not a
    // landmark either — a shell may have several regions, so assuming one mints duplicates.
    expect(screen.queryByRole("toolbar")).toBeNull();
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("let the call site declare a landmark when the region genuinely is one", () => {
    render(<StatusStrip />);
    expect(screen.getByRole("contentinfo", { name: "Status" })).toBeTruthy();
  });

  it("impose no height, surface or typography of their own", () => {
    render(<ShellHeader>chrome</ShellHeader>);

    // The whole point of the ShellBar correction: a region places and separates, nothing
    // more. If someone reintroduces an IDE height or a card surface here, this fails.
    const cls = screen.getByText("chrome").className;
    expect(cls).not.toMatch(/\bh-\d|\bbg-|text-\[length:|text-xs|text-sm/);
    expect(cls).toContain("border-b");
  });
});

describe("a ToggleGroup composed inside a region", () => {
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

describe("the shell regions", () => {
  it("renders exactly one <main>, and it is ShellMain", () => {
    render(
      <ShellRoot>
        <ShellHeader>chrome</ShellHeader>
        <ShellBody>
          <ShellAside aria-label="Navigation" side="start" width={240} />
          <ShellMain>content</ShellMain>
          <ShellAside aria-label="Inspector" side="end" width={280} />
        </ShellBody>
      </ShellRoot>,
    );

    // Two <main> elements are an HTML conformance error and make "skip to main content"
    // ambiguous. The regions around it are <aside>, which is why they can repeat.
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main").getAttribute("data-slot")).toBe("shell-main");
  });

  it("lets both asides coexist as distinguishable landmarks", () => {
    render(
      <ShellBody>
        <ShellAside aria-label="Navigation" side="start" />
        <ShellAside aria-label="Inspector" side="end" />
      </ShellBody>,
    );

    // <aside> is a complementary landmark, so two of them need labels to be told apart.
    expect(screen.getByRole("complementary", { name: "Navigation" })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeTruthy();
  });

  it("uses logical borders so the shell mirrors under RTL", () => {
    render(
      <ShellBody>
        <ShellAside aria-label="Navigation" side="start" />
      </ShellBody>,
    );

    // border-e / border-s, never border-r / border-l: one code path for both directions.
    const aside = screen.getByRole("complementary", { name: "Navigation" });
    expect(aside.className).toContain("border-e");
    expect(aside.className).not.toContain("border-r");
  });

  it("applies a docked width but never an overlay one", () => {
    const { rerender } = render(<ShellAside aria-label="Dock" width={240} />);
    expect(screen.getByRole("complementary").style.width).toBe("240px");

    // An overlay fills its container via `inset-0`; a width would fight it.
    rerender(<ShellAside aria-label="Dock" overlay width={240} />);
    expect(screen.getByRole("complementary").style.width).toBe("");
  });
});
