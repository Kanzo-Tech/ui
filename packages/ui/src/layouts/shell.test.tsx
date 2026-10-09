import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  ShellAside,
  ShellBody,
  ShellFooter,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "./shell.js";
import { ShellDockItem, ShellDockSwitcher } from "./shell-dock.js";

const panels = [
  { id: "files", label: "Files" },
  { id: "search", label: "Search" },
  { id: "git", label: "Source control" },
] as const;

type Panel = (typeof panels)[number]["id"];

const Glyph = () => <svg aria-hidden />;

/** A page's dock: the switcher in its footer, and the open panel, titled in words. */
function Dock({ initial = "files" }: { initial?: Panel | null }) {
  // The page's own id type, handed straight to the switcher: `setPanel` takes no `string`.
  const [panel, setPanel] = useState<Panel | null>(initial);
  const open = panels.find((p) => p.id === panel);
  return (
    <>
      {open ? <ShellAside aria-label={open.label} side="end" /> : null}
      {/* The IDE density (h-[1.625rem], the small font) is the CALLER's, applied here as
          ordinary classes. The region itself has no aesthetic. */}
      <ShellFooter
        aria-label="Status"
        className="h-[1.625rem] flex-row items-center gap-2 bg-card px-1.5 text-[11px] text-muted-foreground"
        role="contentinfo"
      >
        <span className="min-w-0 flex-1">Ready</span>
        <ShellDockSwitcher aria-label="Side panels" onValueChange={setPanel} value={panel}>
          {panels.map(({ id, label }) => (
            <ShellDockItem icon={Glyph} key={id} label={label} value={id} />
          ))}
        </ShellDockSwitcher>
      </ShellFooter>
    </>
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
    render(<Dock />);
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

describe("ShellDockSwitcher", () => {
  it("is a radiogroup named by the page, and hands back the page's own panel type", () => {
    render(<Dock />);
    expect(screen.getByRole("radiogroup", { name: "Side panels" })).toBeTruthy();

    const typed = (next: Panel | null) => next;
    // @ts-expect-error a radiogroup's name is required, and no default fits every dock
    void (<ShellDockSwitcher onValueChange={typed} value="files" />);
    // @ts-expect-error onValueChange hands back the type of `value`, not a wider one
    void (<ShellDockSwitcher aria-label="Panels" onValueChange={(next: "files" | null) => next} value={"search" as Panel} />);
  });

  it("an item is named by its label, pressed while open, and collapses its panel when pressed again", async () => {
    const user = userEvent.setup();
    render(<Dock />);

    const files = screen.getByRole("radio", { name: "Files" });
    expect(files.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("complementary", { name: "Files" })).toBeTruthy();

    await user.hover(files);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Files");

    await user.click(screen.getByRole("radio", { name: "Search" }));
    expect(screen.getByRole("radio", { name: "Search" }).getAttribute("aria-checked")).toBe("true");
    expect(files.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("complementary", { name: "Search" })).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Search" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("radio", { name: "Search" }).getAttribute("aria-checked")).toBe("false");
  });

  it("keeps the group's own scope/part attributes, so zag can collect the items", () => {
    render(<Dock />);

    // Invert the Tooltip/ToggleGroupItem nesting and these become scope=tooltip /
    // part=trigger, and roving focus dies silently. This is the guard.
    const item = screen.getByRole("radio", { name: "Files" });
    expect(item.getAttribute("data-scope")).toBe("toggle-group");
    expect(item.getAttribute("data-part")).toBe("item");
    expect(item.getAttribute("data-slot")).toBe("shell-dock-item");
  });

  it("moves focus with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<Dock />);

    screen.getByRole("radio", { name: "Files" }).focus();

    // zag focuses inside a rAF, which jsdom runs on a timer — hence waitFor.
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(active()).toBe("Search"));

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(active()).toBe("Files"));
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
