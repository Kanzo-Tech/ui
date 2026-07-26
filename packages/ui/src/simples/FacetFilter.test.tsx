import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FacetFilter, type FacetFilterItem, type FacetFilterProps } from "./FacetFilter.js";

const hosts: FacetFilterItem[] = [
  { count: 7, label: "Alpha", value: "alpha" },
  { count: 3, label: "Beta", value: "beta" },
  { count: 1, label: "Gamma", value: "gamma" },
];

interface HarnessProps extends Omit<Partial<FacetFilterProps>, "onValueChange"> {
  onValueChange?: (next: string[]) => void;
}

// Controlled, as both real call sites are: the value lives in a TanStack column filter on one side
// and in a Mosaic clause on the other, so a test that let the component hold it would be testing a
// mode nobody ships.
const Harness = (props: HarnessProps) => {
  const { items = hosts, label = "Host", value: initial = [], onValueChange, ...rest } = props;
  const [value, setValue] = useState<readonly string[]>(initial);

  return (
    <FacetFilter
      items={items}
      label={label}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      value={value}
      {...rest}
    />
  );
};

const trigger = () => screen.getByRole("button", { name: /Host/ });
const option = (name: RegExp | string) => screen.findByRole("option", { name });

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(trigger());
  return screen.findAllByRole("option");
};

describe("FacetFilter", () => {
  it("renders one row per item, with its count", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const options = await open(user);

    expect(options.map((el) => el.textContent)).toEqual(["Alpha7", "Beta3", "Gamma1"]);
  });

  it("is a listbox and not a menu of checkbox items", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await open(user);

    // The doctrine, asserted: a filter is a value, so closing the surface leaves state behind and
    // the role has to be one that can announce "2 of 3 selected".
    expect(screen.getByRole("listbox")).not.toBeNull();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryAllByRole("menuitemcheckbox")).toHaveLength(0);
  });

  it("badges the number of ticked values on the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await open(user);
    expect(trigger().textContent).toBe("Host");

    await user.click(await option(/Alpha/));
    expect(trigger().textContent).toBe("Host1");

    await user.click(await option(/Gamma/));
    expect(trigger().textContent).toBe("Host2");
  });

  it("accumulates values by default", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(<Harness onValueChange={(next) => changes.push(next)} />);

    await open(user);
    await user.click(await option(/Alpha/));
    await user.click(await option(/Gamma/));

    expect(changes.at(-1)).toEqual(["alpha", "gamma"]);
    expect((await option(/Alpha/)).getAttribute("aria-selected")).toBe("true");
    expect((await option(/Beta/)).getAttribute("aria-selected")).toBe("false");
  });

  it("replaces the value instead of accumulating when multiple is false", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(<Harness multiple={false} onValueChange={(next) => changes.push(next)} />);

    await open(user);
    await user.click(await option(/Alpha/));
    await user.click(await option(/Beta/));

    expect(changes).toEqual([["alpha"], ["beta"]]);
    expect((await option(/Alpha/)).getAttribute("aria-selected")).toBe("false");
    expect(trigger().textContent).toBe("Host1");
  });

  it("lists a ticked value the facets no longer offer, and lets it be unticked", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(<Harness onValueChange={(next) => changes.push(next)} value={["delta"]} />);

    const options = await open(user);
    // `delta` is in nobody's item list — another filter has faceted it away — but it is still in
    // the value, so without this row it would sit in the filter with nothing to untick.
    expect(options.map((el) => el.textContent)).toEqual(["Alpha7", "Beta3", "delta", "Gamma1"]);
    expect((await option("delta")).getAttribute("aria-selected")).toBe("true");

    await user.click(await option("delta"));

    expect(changes).toEqual([[]]);
  });

  it("orders the rows by label and never by count", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        items={[
          { count: 900, label: "Zulu", value: "zulu" },
          { count: 90, label: "Mike", value: "mike" },
          { count: 9, label: "Alpha", value: "alpha" },
        ]}
      />,
    );

    const options = await open(user);

    // Given in count order, drawn in label order: frequency ordering reshuffles the list under the
    // cursor every time another filter moves, so you tick the row that replaced the one you read.
    expect(options.map((el) => el.textContent)).toEqual(["Alpha9", "Mike90", "Zulu900"]);
  });

  it("labels a row by its value when it carries no label", async () => {
    const user = userEvent.setup();
    render(<Harness items={[{ value: "eu-west-1" }, { value: "eu-central-1" }]} />);

    const options = await open(user);

    expect(options.map((el) => el.textContent)).toEqual(["eu-central-1", "eu-west-1"]);
  });
});

describe("FacetFilter clear", () => {
  const clear = () => screen.queryByRole("button", { name: "Clear filter" });

  it("appears only once something is ticked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await open(user);
    expect(clear()).toBeNull();

    await user.click(await option(/Alpha/));

    expect(clear()).not.toBeNull();
  });

  it("empties the value in one press", async () => {
    const user = userEvent.setup();
    const changes: string[][] = [];
    render(
      <Harness
        onValueChange={(next) => changes.push(next)}
        value={["alpha", "beta"]}
      />,
    );

    await open(user);
    expect(trigger().textContent).toBe("Host2");

    await user.click(clear() as HTMLElement);

    expect(changes.at(-1)).toEqual([]);
    expect(trigger().textContent).toBe("Host");
  });
});

describe("FacetFilter empty and note", () => {
  it("shows the empty message when there is nothing on offer", async () => {
    const user = userEvent.setup();
    render(<Harness empty="Loading…" items={[]} />);

    await user.click(trigger());

    expect(await screen.findByText("Loading…")).not.toBeNull();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("draws the note under the list, outside it", async () => {
    const user = userEvent.setup();
    render(<Harness note="Top 3 values — filter further to see the rest." />);

    await open(user);

    const note = document.querySelector("[data-slot=facet-filter-note]");
    expect(note?.textContent).toBe("Top 3 values — filter further to see the rest.");
    expect(screen.getByRole("listbox").contains(note as Node)).toBe(false);
  });

  // Regression. Passing `deselectable` to the listbox — which reads like the prop you want, and
  // whose upstream JSDoc describes the opposite of what it does — binds Escape to VALUE.CLEAR, so
  // the key everyone presses to back out of a popover silently discarded the filter instead.
  //
  // Only the surviving value is asserted. Whether the popover *closes* is Ark's behaviour, not
  // ours, and it cannot be asserted from here: an `aria-expanded` check passes when this test runs
  // alone and fails once the twelve above it have run, because `unmountOnExit` waits on an exit
  // animation jsdom never fires, so every popover those tests opened is still mounted. Verified
  // separately against a bare `Popover`, which does close.
  it("does not discard the filter on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness value={["alpha"]} />);

    await open(user);
    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");

    expect(trigger().textContent).toContain("1");
    expect(await option(/Alpha/)).toHaveProperty("ariaSelected", "true");
  });
});
