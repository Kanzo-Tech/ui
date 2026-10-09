import { act, render, screen } from "@testing-library/react";
import { KanzoThemeProvider } from "@kanzo-tech/ui";
import { MosaicProvider } from "@kanzo-tech/ui/analytics";
import { describe, expect, it } from "vitest";
import { attach, settle, type Attached } from "../../test/corpus";
import { readStructure, timelineTable } from "../core/source";
import { GraphRoot } from "../react/graph-root";
import { GRAPH_SECTION } from "../section";
import { GraphTimeline } from "./graph-timeline";

function mount(corpus: Attached, timeline: string) {
  return render(
    <KanzoThemeProvider
      policy={timeline ? { graph: { "time-by": { pinned: timeline } } } : undefined}
      sections={[GRAPH_SECTION]}
      storage={null}
    >
      <MosaicProvider coordinator={corpus.coordinator}>
        <GraphRoot coordinator={corpus.coordinator} from={corpus.from} onFailure={() => {}}>
          <GraphTimeline />
        </GraphRoot>
      </MosaicProvider>
    </KanzoThemeProvider>,
  );
}

describe("GraphTimeline", () => {
  it("draws nothing until a timeline column is chosen in the graph's settings", async () => {
    const corpus = await attach();
    mount(corpus, "");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });

  it("draws the chosen column as a timeline named by it", async () => {
    const corpus = await attach();
    mount(corpus, "born");
    await act(() => settle(corpus));
    expect(screen.getByRole("figure", { name: "Timeline: born" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("draws nothing for a column this corpus does not have", async () => {
    const corpus = await attach();
    mount(corpus, "founded");
    await act(() => settle(corpus));
    expect(screen.queryByRole("figure")).toBeNull();
  });
});

describe("timelineTable", () => {
  it("reads the column from every vertex table that has it, and from no other", async () => {
    const corpus = await attach();
    const structure = await readStructure(corpus.coordinator, corpus.from);
    const table = timelineTable(structure, "born");
    expect(String(table)).toContain(`"${corpus.from}"."Person"`);
    expect(String(table)).not.toContain(`"Place"`);
    expect(timelineTable(structure, "")).toBeNull();
    expect(timelineTable(structure, "dense_id")).toBeNull();
  });
});
