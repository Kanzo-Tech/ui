import { act, render, screen, waitFor } from "@testing-library/react";
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
  // **The trigger is the only honest witness here**, and this test learned it the hard way: it
  // originally also asserted the row was still selected, which passed only because the popover's
  // content was still in the DOM. Neither the closed popover's contents nor `aria-expanded` are
  // assertable from this file — `unmountOnExit` waits on an exit animation jsdom never fires, so
  // whether the list is still there depends on how many popovers the tests above happened to leave
  // mounted. Assert what outlives the surface. That the popover closes at all is Ark's behaviour,
  // verified separately against a bare `Popover`.
  it("does not discard the filter on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness value={["alpha"]} />);

    await open(user);
    screen.getByRole("listbox").focus();
    await user.keyboard("{Escape}");

    expect(trigger().textContent).toContain("1");
  });
});

describe("FacetFilter searchable", () => {
  const stations: FacetFilterItem[] = [
    { count: 4, label: "A Coruña", value: "leco" },
    { count: 9, label: "Madrid", value: "lemd" },
    { count: 2, label: "Málaga", value: "lega" },
  ];

  const field = () => screen.getByRole("textbox", { name: "Filter values" });
  const labels = () => screen.getAllByRole("option").map((el) => el.textContent);

  // `delay: null` rather than the default. Every keystroke replaces the collection — that is the
  // feature — and `autoHighlight` re-aims the highlight in a `queueMicrotask`, so each character
  // schedules a React update outside `act`. With userEvent's default real-timer delay between
  // keys, that update lands mid-sequence and React restores the controlled input to the value it
  // is committing, silently eating characters; the number eaten grows with how much of the file
  // has already run, so the same test passes alone and fails in place. `delay: null` puts the
  // whole sequence in one batch. Nothing to fix in a browser, where nothing interleaves.
  const typist = () => userEvent.setup({ delay: null });

  // `autoHighlight` re-aims the highlight from a `queueMicrotask`, one per collection change — and
  // every keystroke is a collection change. So a three-letter query leaves a queue of highlight
  // resets behind it, each of which unconditionally re-selects the first row. A browser drains that
  // queue in the milliseconds before the next keypress; a test presses the next key in the same
  // tick, and a reset lands *after* the arrow that was supposed to move off the first row. Drain it
  // deliberately instead: this is the difference between a test and a user, not a bug.
  const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

  const highlighted = () =>
    waitFor(() => {
      const id = screen.getByRole("listbox").getAttribute("aria-activedescendant");
      expect(id).toBeTruthy();
      return document.getElementById(id as string);
    });

  it("draws no field unless asked — it is a prop, not a count threshold", async () => {
    const user = typist();
    render(<Harness items={stations} />);

    await open(user);

    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("narrows the rows on offer to what the query matches", async () => {
    const user = typist();
    render(<Harness items={stations} searchable />);

    await open(user);
    await user.type(field(), "mad");

    expect(labels()).toEqual(["Madrid9"]);
  });

  it("ignores case and accents, because `useFilter` does", async () => {
    const user = typist();
    render(<Harness items={stations} searchable />);

    await open(user);
    await user.type(field(), "CORUNA");

    // Neither the capitals nor the missing tilde blocks the match: `useFilter({ sensitivity:
    // "base" })` collates rather than comparing code points, so a hand-rolled `toLowerCase()
    // .includes()` would have missed this row.
    expect(labels()).toEqual(["A Coruña4"]);
  });

  it("matches the value when a row carries no label", async () => {
    const user = typist();
    render(<Harness items={[{ value: "eu-west-1" }, { value: "us-east-1" }]} searchable />);

    await open(user);
    await user.type(field(), "west");

    expect(labels()).toEqual(["eu-west-1"]);
  });

  // The first of the two rules this component owns, under a query. Hiding a ticked row takes the
  // untick with it: the value is still in the filter, and nothing on screen can remove it.
  it("never hides a ticked value behind the query", async () => {
    const user = typist();
    const changes: string[][] = [];
    render(
      <Harness
        items={stations}
        onValueChange={(next) => changes.push(next)}
        searchable
        value={["lemd"]}
      />,
    );

    await open(user);
    await user.type(field(), "coru");

    expect(labels()).toEqual(["A Coruña4", "Madrid9"]);

    await user.click(await option(/Madrid/));

    expect(changes).toEqual([[]]);
  });

  // The second rule, under a query. A filtered list is still a label-ordered list.
  it("keeps label ordering through the query", async () => {
    const user = typist();
    render(
      <Harness
        items={[
          { count: 900, label: "Zulu Alpha", value: "za" },
          { count: 90, label: "Mike Alpha", value: "ma" },
          { count: 9, label: "Alpha Alpha", value: "aa" },
        ]}
        searchable
      />,
    );

    await open(user);
    await user.type(field(), "alpha");

    expect(labels()).toEqual(["Alpha Alpha9", "Mike Alpha90", "Zulu Alpha900"]);
  });

  it("drives the list from the field: typing highlights the top match, Enter ticks it", async () => {
    const user = typist();
    const changes: string[][] = [];
    render(
      <Harness items={stations} onValueChange={(next) => changes.push(next)} searchable />,
    );

    await open(user);
    await user.type(field(), "m");
    await settle();
    // `autoHighlight` re-aims at the first surviving row on every keystroke, so the top match is
    // under Enter with no ArrowDown first — "Madrid" here, ahead of "Málaga" by label.
    expect((await highlighted())?.textContent).toBe("Madrid9");

    await user.keyboard("{Enter}");

    await waitFor(() => expect(changes).toEqual([["lemd"]]));
    expect(document.activeElement).toBe(field());
  });

  it("still arrows and Enters down the filtered list", async () => {
    const user = typist();
    const changes: string[][] = [];
    render(
      <Harness items={stations} onValueChange={(next) => changes.push(next)} searchable />,
    );

    await open(user);
    await user.type(field(), "m");
    await settle();
    // The arrow reaches the list from inside the field — zag forwards it to the content — and moves
    // off the row `autoHighlight` had aimed at.
    await user.keyboard("{ArrowDown}");
    await settle();
    expect((await highlighted())?.textContent).toBe("Málaga2");

    await user.keyboard("{Enter}");

    await waitFor(() => expect(changes).toEqual([["lega"]]));
  });

  // The field is useless if the first thing you type goes somewhere else. Zag's popover aims its
  // opening focus at the content, and does it late enough that a keystroke can arrive first — the
  // key then reaches the list as typeahead and focus moves out from under the caret. `FacetFilter`
  // points `initialFocusEl` at the field instead.
  it("opens with the field focused, so you can just type", async () => {
    const user = typist();
    render(<Harness items={stations} searchable />);

    await open(user);

    await waitFor(() => expect(document.activeElement).toBe(field()));
  });

  it("forgets the query when the surface closes", async () => {
    const user = typist();
    render(<Harness items={stations} searchable />);

    await open(user);
    await user.type(field(), "mad");
    expect(labels()).toEqual(["Madrid9"]);

    await user.click(trigger());
    await user.click(trigger());

    // `Popover` unmounts its content, taking the input's DOM value with it; the query state has to
    // go too, or a reopened filter shows every row while still believing in "mad".
    expect((field() as HTMLInputElement).value).toBe("");
    expect(labels()).toEqual(["A Coruña4", "Madrid9", "Málaga2"]);
  });

  it("tells 'this facet offers nothing' from 'your query matches nothing'", async () => {
    const user = typist();
    const { rerender } = render(<Harness items={stations} searchable />);

    await open(user);
    await user.type(field(), "zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matching values.")).not.toBeNull();
    expect(screen.queryByText("No values.")).toBeNull();

    // Same emptiness on screen, different news: nothing on offer at all is not a query you can
    // retype your way out of, and it is usually "still loading".
    rerender(<Harness items={[]} searchable />);

    expect(screen.getByText("No values.")).not.toBeNull();
    expect(screen.queryByText("No matching values.")).toBeNull();
  });

  it("takes the two messages from props", async () => {
    const user = typist();
    render(
      <Harness
        empty="Loading…"
        items={stations}
        searchEmpty="No station by that name."
        searchable
      />,
    );

    await open(user);
    await user.type(field(), "zzz");

    expect(screen.getByText("No station by that name.")).not.toBeNull();
  });

  it("names and prompts the field, and takes both from props", async () => {
    const user = typist();
    render(
      <Harness
        items={stations}
        searchLabel="Filter stations"
        searchPlaceholder="Station…"
        searchable
      />,
    );

    await open(user);

    const input = screen.getByRole("textbox", { name: "Filter stations" });
    expect(input.getAttribute("placeholder")).toBe("Station…");
  });
});
