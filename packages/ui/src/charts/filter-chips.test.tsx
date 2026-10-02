import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clauseInterval, clausePoints, Selection, type Coordinator } from "@uwdata/mosaic-core";
import { describe, expect, it } from "vitest";
import { clauseLabel, FilterChips } from "./filter-chips.js";
import { MosaicProvider, useMosaic } from "./mosaic-provider.js";

const coordinator = {} as Coordinator;
const source = (name: string) => ({ name });

describe("clauseLabel", () => {
  it("reads a point, a set and a range without the database's quoting", () => {
    expect(clauseLabel(clausePoints(["beast"], [["harpy"]], { source: source("a") }))).toBe("beast harpy");
    expect(clauseLabel(clausePoints(["beast"], [["harpy"], ["wyrm"]], { source: source("b") }))).toBe("beast · 2 selected");
    expect(clauseLabel(clauseInterval("hour", [6, 13.5], { source: source("c") }))).toBe("hour 6 – 13.5");
  });
});

describe("retract", () => {
  it("removes a chart's clause where it was published, so it leaves the chart's own selection too", async () => {
    const crossfilter = Selection.crossfilter();
    const own = Selection.union();
    let context: ReturnType<typeof useMosaic> | null = null;
    function Probe() {
      context = useMosaic();
      return null;
    }
    const user = userEvent.setup();
    render(
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <Probe />
        <FilterChips />
      </MosaicProvider>,
    );
    context!.registerSelection(own, { relay: true });
    own.update(clausePoints(["beast"], [["harpy"]], { source: source("pick") }));

    await user.click(await screen.findByRole("button", { name: "Remove beast harpy" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull());
    expect(own.clauses).toHaveLength(0);
    expect(crossfilter.clauses).toHaveLength(0);
  });
});
