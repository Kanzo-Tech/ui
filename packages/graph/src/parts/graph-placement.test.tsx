import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import type { Channels } from "../core/channels";
import { GraphRoot } from "../react/graph-root";
import { GraphPlacement } from "./graph-placement";

/**
 * The placement row over a real corpus's structure: which fields each card offers, and what a
 * choice hands the host. What it cannot prove is the picture a binding draws — `store.test.ts` has
 * the positions, and `render/placement.test.ts` the orientation.
 */
type Placed = Pick<Channels, "x" | "y" | "cluster">;

function Host({ corpus, into, spy }: { corpus: Attached; into: { value?: Placed }; spy?: (value: Placed) => void }) {
  const [value, setValue] = useState<Placed>({});
  into.value = value;
  return (
    <GraphRoot coordinator={corpus.coordinator} from={corpus.from} onFailure={() => {}} {...value}>
      <GraphPlacement
        onChange={(next) => {
          spy?.(next);
          setValue(next);
        }}
        value={value}
      />
    </GraphRoot>
  );
}

beforeEach(() => {
  vi.stubGlobal("CSS", { escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) });
});
afterEach(() => vi.unstubAllGlobals());

const options = (name: string) =>
  [...(screen.getByRole("combobox", { name }) as HTMLSelectElement).options].map((option) => option.value).filter(Boolean);

describe("GraphPlacement", () => {
  it("starts at Force with no column to choose", async () => {
    const corpus = await attach();
    render(<Host corpus={corpus} into={{}} />);
    await act(() => settle(corpus));
    expect((screen.getByRole("radio", { name: "Force" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("is one row of cards, each with a picture of its mode, and one line for the checked mode", async () => {
    const corpus = await attach();
    render(<Host corpus={corpus} into={{}} />);
    await act(() => settle(corpus));
    for (const name of ["Force", "Map", "Clustered"]) {
      expect(screen.getByRole("radio", { name }).closest("[data-slot=radio-group-card]")?.querySelector("svg"), name).toBeTruthy();
    }
    expect(screen.getAllByText(/until it settles/)).toHaveLength(1);
    await userEvent.setup().click(screen.getByRole("radio", { name: "Map" }));
    expect(screen.queryByText(/until it settles/)).toBeNull();
    expect(screen.getByText(/nothing simulates/)).toBeTruthy();
  });

  it("binds x and y over the numeric fields inside Map, and says a half binding still runs", async () => {
    const corpus = await attach();
    const held: { value?: Placed } = {};
    render(<Host corpus={corpus} into={held} />);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Map" }));
    // `name` is a string and `subject`/`dense_id` are fossil's, so none of them is offered.
    await waitFor(() => expect(options("x")).toEqual(["lat", "lon", "score", "team"]));
    await user.selectOptions(screen.getByRole("combobox", { name: "x" }), "lon");
    expect(held.value).toEqual({ x: "lon", y: undefined });
    expect(screen.getByText(/until then the layout runs/)).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox", { name: "y" }), "lat");
    expect(held.value).toEqual({ x: "lon", y: "lat" });
    await act(() => settle(corpus));
  });

  it("keeps Map's selects out of the card: a click opens the select, the pick reaches onChange, Map stays checked", async () => {
    const corpus = await attach();
    const spy = vi.fn();
    render(<Host corpus={corpus} into={{}} spy={spy} />);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    const map = screen.getByRole("radio", { name: "Map" });
    await user.click(map);
    spy.mockClear();
    const x = await screen.findByRole("combobox", { name: "x" });
    // The selects are not the radio's: no radio's label holds them, and their group is named after Map.
    expect(x.closest("label")).toBeNull();
    expect(screen.getByRole("group", { name: "Map columns" }).contains(x)).toBe(true);
    await user.click(x);
    expect(document.activeElement).toBe(x);
    await waitFor(() => expect(options("x")).toContain("lon"));
    await user.selectOptions(x, "lon");
    // Clicking into the select hands the radio nothing: one call, the binding, and Map still checked.
    expect(spy.mock.calls).toEqual([[{ x: "lon", y: undefined }]]);
    // Its visible label focuses the select, not the radio.
    await user.click(screen.getByText("y", { selector: "label" }));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "y" }));
    expect((map as HTMLInputElement).checked).toBe(true);
    await act(() => settle(corpus));
  });

  it("binds cluster over any field inside Clustered, and Force clears every binding", async () => {
    const corpus = await attach();
    const held: { value?: Placed } = {};
    render(<Host corpus={corpus} into={held} />);
    await act(() => settle(corpus));
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Clustered" }));
    await waitFor(() => expect(options("cluster")).toEqual(["lat", "lon", "name", "score", "team"]));
    await user.selectOptions(screen.getByRole("combobox", { name: "cluster" }), "team");
    expect(held.value).toEqual({ cluster: "team" });
    await user.click(screen.getByRole("radio", { name: "Force" }));
    expect(held.value).toEqual({});
    await act(() => settle(corpus));
  });
});
