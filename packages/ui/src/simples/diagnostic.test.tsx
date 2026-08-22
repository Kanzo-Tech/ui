import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticContent,
  DiagnosticDescription,
  DiagnosticFrame,
  DiagnosticFrames,
  DiagnosticHeader,
  DiagnosticList,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticTitle,
  DiagnosticTrigger,
} from "./diagnostic.js";

const renderOne = (props?: {
  variant?: "destructive" | "warning" | "info";
  defaultOpen?: boolean;
  onSelect?: () => void;
}) =>
  render(
    <DiagnosticList>
      <Diagnostic defaultOpen={props?.defaultOpen} variant={props?.variant ?? "destructive"}>
        <DiagnosticHeader>
          <DiagnosticSeverity>Error</DiagnosticSeverity>
          <DiagnosticTitle>A writ may not be signed by fewer than four</DiagnosticTitle>
          <DiagnosticSource>a writ needs a seal</DiagnosticSource>
          <DiagnosticActions>
            <DiagnosticTrigger>2 positions</DiagnosticTrigger>
          </DiagnosticActions>
        </DiagnosticHeader>

        <DiagnosticContent>
          <DiagnosticDescription>The party is three, and none of them a warden.</DiagnosticDescription>
          <DiagnosticFrames>
            <DiagnosticFrame
              column={3}
              label="the rule"
              line={4}
              onSelect={props?.onSelect}
              path="standing-orders.rules"
            />
            <DiagnosticFrame path="ledger/Q-1058" secondary />
          </DiagnosticFrames>
        </DiagnosticContent>
      </Diagnostic>
    </DiagnosticList>,
  );

const frames = (container: HTMLElement) => [
  ...container.querySelectorAll("[data-slot=diagnostic-frame]"),
];

describe("DiagnosticList", () => {
  it("is a list of listitems, which is what a group of diagnostics is", () => {
    renderOne();

    const list = screen.getByRole("list");
    expect(list.getAttribute("data-slot")).toBe("diagnostic-list");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(list.contains(screen.getByRole("listitem"))).toBe(true);
  });
});

describe("Diagnostic", () => {
  it("keeps its body out of the document until the trigger is pressed", async () => {
    const user = userEvent.setup();
    renderOne();

    expect(screen.queryByText("The party is three, and none of them a warden.")).toBeNull();

    await user.click(screen.getByRole("button", { name: /2 positions/ }));

    expect(screen.getByText("The party is three, and none of them a warden.")).not.toBeNull();
  });

  it("takes defaultOpen, so a diagnostic can arrive expanded", () => {
    renderOne({ defaultOpen: true });

    expect(screen.getByText("The party is three, and none of them a warden.")).not.toBeNull();
  });

  it("announces the trigger's open state, which is Ark's contract and not ours", async () => {
    const user = userEvent.setup();
    renderOne();

    const trigger = screen.getByRole("button", { name: /2 positions/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await user.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("reports open state to the caller", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Diagnostic onOpenChange={onOpenChange} variant="info">
        <DiagnosticHeader>
          <DiagnosticTrigger>Detail</DiagnosticTrigger>
        </DiagnosticHeader>
        <DiagnosticContent>body</DiagnosticContent>
      </Diagnostic>,
    );

    await user.click(screen.getByRole("button", { name: /Detail/ }));

    expect(onOpenChange).toHaveBeenCalledWith({ open: true });
  });

  /**
   * **`Alert`'s surface, which is the reference's.** This wore a `border-s-2` rail in the family's
   * colour over a neutral wash — a card with a bar down one edge, a shape that appears nowhere in
   * Shark UI and nowhere else in this library. The wash at `-a3` and the whole outline at `-a6`
   * are `Alert`'s exact steps, and a diagnostic is the same thing `Alert` is: a message with a
   * severity.
   */
  it("wears the variant the way an Alert does, not as a coloured rail", () => {
    renderOne({ variant: "warning" });

    const root = screen.getByRole("listitem");
    expect(root.className).toContain("bg-warning/7");
    expect(root.className).toContain("border-warning/30");
    expect(root.className).not.toContain("border-s-2");
  });

  /**
   * This asserted `not.toContain("flex-wrap")` and was wrong about which rule it was defending.
   *
   * A list of six aligns because the **title** is `basis-0` and `truncate`, not because the header
   * refuses to wrap: with `basis-0` nothing forces a break, so a header that fits is one line
   * either way. What `flex-nowrap` actually did was make the title 0 px wide in a narrow column —
   * measured at 143 px on the metadata-form panel, the title starting 72 px past the header's own
   * right edge. The two assertions below are the alignment rule; the wrap is what happens when
   * alignment is no longer possible.
   */
  it("aligns a list off the title's basis, not off the header refusing to wrap", () => {
    const { container } = renderOne();

    const header = container.querySelector("[data-slot=diagnostic-header]");
    expect(header?.className).toContain("flex-wrap");
    const title = container.querySelector("[data-slot=diagnostic-title]");
    expect(title?.className).toContain("truncate");
    // `flex-1` is `1 1 0%` — the basis that keeps a title from forcing a line of its own.
    expect(title?.className).toContain("flex-1");
  });
});

describe("DiagnosticSeverity", () => {
  /**
   * **It is a real `Badge`, and it used to be one respelled** — `h-5 min-w-5 px-1.5 rounded-md
   * text-xs` plus three `group-data-[severity=…]` lines repainting by hand the three soft variants
   * `Badge` already ships. `Tool`'s state chip has always used the real one.
   *
   * The variant is still declared once, on the root: this reads it from context and hands it to
   * `Badge`, so no call site passes it twice.
   */
  it("is a Badge wearing the root's variant, which it never takes as a prop", () => {
    renderOne({ variant: "warning" });

    const root = screen.getByRole("listitem");
    const badge = screen.getByText("Error").closest("[data-slot=diagnostic-severity]");

    expect(root.getAttribute("data-variant")).toBe("warning");
    expect(badge?.getAttribute("data-variant")).toBe("warning");
    expect(badge?.className).toContain("bg-warning/7");
    // Nothing hand-painted survives: the colour comes from the recipe, not from a group selector.
    expect(badge?.className).not.toContain("group-data-");
  });

  it("draws the icon the root asks for, which is the half no selector can carry", () => {
    const drawn = (["destructive", "warning", "info"] as const).map((variant) => {
      const { container } = render(
        <Diagnostic variant={variant}>
          <DiagnosticHeader>
            <DiagnosticSeverity>{variant}</DiagnosticSeverity>
          </DiagnosticHeader>
        </Diagnostic>,
      );
      return container
        .querySelector("[data-slot=diagnostic-severity] svg")
        ?.getAttribute("class");
    });

    // A word alone is the weakest severity there is. Three severities, three glyphs, and none of
    // them passed in by the call site.
    expect(drawn.filter(Boolean)).toHaveLength(3);
    expect(new Set(drawn).size).toBe(3);
  });

  it("defaults to destructive, because an unlabelled diagnostic is not good news", () => {
    render(<Diagnostic>body</Diagnostic>);

    expect(screen.getByText("body").getAttribute("data-variant")).toBe("destructive");
  });
});

describe("DiagnosticFrame", () => {
  it("is a real button when the call site can act on it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container } = renderOne({ defaultOpen: true, onSelect });

    const [frame] = frames(container);
    expect(frame?.tagName).toBe("BUTTON");
    expect(frame?.getAttribute("type")).toBe("button");

    await user.click(frame as HTMLElement);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("is static text when it is not, rather than a control that answers to nothing", () => {
    const { container } = renderOne({ defaultOpen: true });

    const [frame] = frames(container);
    expect(frame?.tagName).toBe("SPAN");
    expect(frame?.getAttribute("data-slot")).toBe("diagnostic-frame");
    // Neither frame is pressable, so the only button in the document is the trigger.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("looks pressable at rest, and is named for a screen reader when it is", () => {
    const { container } = render(
      <>
        <DiagnosticFrame label="the rule" line={4} onSelect={() => {}} path="a/rules" />
        <DiagnosticFrame label="the rule" line={4} path="a/rules" />
      </>,
    );

    const [pressable, plain] = frames(container);
    // The arrow is the resting difference: hover and focus are states nobody scanning a list is in.
    expect(pressable?.querySelector("svg")).not.toBeNull();
    expect(plain?.querySelector("svg")).toBeNull();
    // The rhythm that separates path from label is visual only, so the name is composed.
    expect(pressable?.getAttribute("aria-label")).toBe("a/rules:4 — the rule");
    expect(plain?.getAttribute("aria-label")).toBeNull();
  });

  it("spells the position from what it was given, and no further", () => {
    const { container } = render(
      <>
        <DiagnosticFrame path="only/a/path" />
        <DiagnosticFrame line={12} path="a/line" />
        <DiagnosticFrame column={7} line={12} path="both" />
      </>,
    );

    const read = frames(container).map((frame) => frame.textContent);
    expect(read).toEqual(["only/a/path", "a/line:12", "both:12:7"]);
  });

  it("reads a position as a location: the directory recedes, the file carries the weight", () => {
    const { container } = render(
      <DiagnosticFrame column={7} line={12} path="ledger/Q-1058/party" />,
    );
    const part = (name: string) =>
      container.querySelector(`[data-slot=diagnostic-frame-${name}]`);

    expect(part("directory")?.textContent).toBe("ledger/Q-1058/");
    expect(part("file")?.textContent).toBe("party");
    expect(part("position")?.textContent).toBe(":12:7");
    expect(part("directory")?.className).toContain("text-muted-foreground");
    expect(part("file")?.className).toContain("font-medium");
    // Line and column are the one column of digits in the component that has to line up.
    expect(part("position")?.className).toContain("tabular-nums");
  });

  it("draws no directory when the path has none", () => {
    const { container } = render(<DiagnosticFrame path="standing-orders.rules" />);

    expect(container.querySelector("[data-slot=diagnostic-frame-directory]")).toBeNull();
    expect(container.querySelector("[data-slot=diagnostic-frame-file]")?.textContent).toBe(
      "standing-orders.rules",
    );
  });

  it("dims a secondary frame on two channels and keeps it in the document", () => {
    const { container } = renderOne({ defaultOpen: true });

    const secondary = frames(container)[1];
    expect(secondary?.getAttribute("data-secondary")).toBe("");
    expect(secondary?.textContent).toBe("ledger/Q-1058");
    // Ink, and the weight on the file — a reader scanning a stack sees the second before the first.
    // `--muted-foreground` rather than `--faint`: the recipe carries the measurement.
    expect(secondary?.className).toContain("text-muted-foreground");
    expect(secondary?.className).toContain(
      "[&_[data-slot=diagnostic-frame-file]]:font-normal",
    );
  });
});

describe("the parts", () => {
  it("each own a data-slot a recipe or a consumer can select", () => {
    const { container } = renderOne({ defaultOpen: true });

    for (const name of [
      "diagnostic-list",
      "diagnostic",
      "diagnostic-header",
      "diagnostic-severity",
      "diagnostic-title",
      "diagnostic-source",
      "diagnostic-actions",
      "diagnostic-trigger",
      "diagnostic-content",
      "diagnostic-description",
      "diagnostic-frames",
      "diagnostic-frame",
      "diagnostic-frame-file",
      "diagnostic-frame-position",
      "diagnostic-frame-label",
    ]) {
      expect(container.querySelector(`[data-slot=${name}]`), name).not.toBeNull();
    }
  });

  it("lets a part be renamed through slot, on the wrapped Ark parts too", () => {
    const { container } = render(
      <Diagnostic defaultOpen slot="finding">
        <DiagnosticTrigger slot="finding-trigger">Detail</DiagnosticTrigger>
        <DiagnosticContent slot="finding-content">body</DiagnosticContent>
      </Diagnostic>,
    );

    expect(container.querySelector("[data-slot=finding]")).not.toBeNull();
    expect(container.querySelector("[data-slot=finding-trigger]")).not.toBeNull();
    expect(container.querySelector("[data-slot=finding-content]")).not.toBeNull();
    expect(container.querySelector("[data-slot=collapsible-trigger]")).toBeNull();
  });
});
