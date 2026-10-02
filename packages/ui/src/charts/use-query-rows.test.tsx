import { act, cleanup, render, screen } from "@testing-library/react";
import type { Coordinator } from "@uwdata/mosaic-core";
import { Component, Suspense, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MosaicProvider } from "./mosaic-provider.js";
import { useQueryRows } from "./use-query-rows.js";

/** A coordinator whose answers the test settles by hand: an Arrow table is anything with `toArray`. */
function deferred() {
  const asked: { sql: string; settle: (rows: unknown[]) => void; refuse: (error: unknown) => void }[] = [];
  const coordinator = {
    clear() {},
    query: vi.fn(
      (sql: string) =>
        new Promise((resolve, reject) =>
          asked.push({ sql, settle: (rows) => resolve({ toArray: () => rows }), refuse: reject }),
        ),
    ),
  } as unknown as Coordinator & { query: ReturnType<typeof vi.fn> };
  return { coordinator, asked };
}

class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state = { error: undefined as unknown };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  override render() {
    return this.state.error === undefined ? this.props.children : <p>failed: {String((this.state.error as Error).message)}</p>;
  }
}

function Names({ sql }: { sql: string }) {
  const rows = useQueryRows<{ name: string }>(sql);
  return <p>{rows.map((row) => row.name).join(", ")}</p>;
}

/**
 * Mounted inside an async `act`, which is what lets React's retry after a suspension run under the
 * test: mounted outside one, the fallback stays up after the promise settles.
 */
const mount = (node: ReactNode) => act(async () => void render(node));

const page = (coordinator: Coordinator, children: ReactNode) => (
  <MosaicProvider coordinator={coordinator}>
    <Boundary>
      <Suspense fallback={<p>loading</p>}>{children}</Suspense>
    </Boundary>
  </MosaicProvider>
);

describe("useQueryRows", () => {
  it("suspends until the rows land, then draws them as objects keyed by column", async () => {
    const { coordinator, asked } = deferred();
    await mount(page(coordinator, <Names sql="SELECT name FROM people" />));
    expect(screen.getByText("loading")).toBeTruthy();
    await act(async () => asked[0]!.settle([{ name: "Ada" }, { name: "Grace" }]));
    expect(screen.getByText("Ada, Grace")).toBeTruthy();
  });

  it("asks a statement once, however many components read it", async () => {
    const { coordinator, asked } = deferred();
    await mount(
      page(
        coordinator,
        <>
          <Names sql="SELECT name FROM once" />
          <Names sql="SELECT name FROM once" />
        </>,
      ),
    );
    await act(async () => asked[0]!.settle([{ name: "Ada" }]));
    expect(screen.getAllByText("Ada")).toHaveLength(2);
    expect(coordinator.query).toHaveBeenCalledTimes(1);
  });

  it("throws a failure to the boundary as it was thrown, and asks again after it", async () => {
    const { coordinator, asked } = deferred();
    const refused = Object.assign(new Error("Catalog Error: no table"), { code: "x/y" });
    await mount(page(coordinator, <Names sql="SELECT name FROM nowhere" />));
    await act(async () => asked[0]!.refuse(refused));
    expect(screen.getByText("failed: Catalog Error: no table")).toBeTruthy();
    cleanup();
    await act(() => new Promise((next) => setTimeout(next, 0)));
    await mount(page(coordinator, <Names sql="SELECT name FROM nowhere" />));
    expect(coordinator.query).toHaveBeenCalledTimes(2);
  });
});
