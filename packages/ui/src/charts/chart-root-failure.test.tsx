import { render, screen, waitFor } from "@testing-library/react";
import { QueryError, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartBarY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { MosaicProvider } from "./mosaic-provider.js";

/**
 * The plot is built here, unlike in `chart-root.test.tsx`: the container is given a width, and the
 * coordinator answers every vgplot mark it is handed with a failure, as `Coordinator.updateClient`
 * does when DuckDB refuses the query: wrapped in a `QueryError`, which the host never sees.
 */
const failure = Object.assign(new Error("Catalog Error: Table with name telemetry does not exist"), {
  code: "x/y",
});

const coordinator = {
  clear() {},
  connect(client: MosaicClient) {
    queueMicrotask(() => client.queryError(new QueryError(failure, "SELECT * FROM telemetry")));
  },
  disconnect() {},
} as unknown as Coordinator;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly report: ResizeObserverCallback) {}
      observe() {
        this.report([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a chart whose query fails", () => {
  it("draws the failure in its own frame, not a blank plot, and hands the host the thrown value", async () => {
    const onFailure = vi.fn();
    const { container } = render(
      <MosaicProvider coordinator={coordinator} onFailure={onFailure}>
        <ChartRoot table="telemetry">
          <ChartBarY x="host" y="n" />
        </ChartRoot>
      </MosaicProvider>,
    );

    expect(await screen.findByText("This chart could not be drawn.")).toBeTruthy();
    await waitFor(() => expect(onFailure).toHaveBeenCalled());
    expect(onFailure.mock.calls[0]![0]).toBe(failure);
    expect(container.querySelector("[data-slot=chart]")?.className).toContain("hidden");
  });
});
