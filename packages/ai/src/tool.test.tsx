import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool.js";
import type { RunState } from "./task.js";

const Call = (props: { state?: RunState }) => (
  <Tool state={props.state}>
    <ToolHeader>query</ToolHeader>
    <ToolContent>
      <ToolInput>
        <code>select count(*) from node</code>
      </ToolInput>
      <ToolOutput>4 rows</ToolOutput>
    </ToolContent>
  </Tool>
);

const root = () => document.querySelector("[data-slot=tool]") as HTMLElement;
const collapsible = () => document.querySelector("[data-slot=tool-collapsible]") as HTMLElement;

describe("Tool", () => {
  it("opens itself once there is a result, and not before", async () => {
    const { rerender } = render(<Call state="running" />);
    expect(screen.queryByText("4 rows")).toBeNull();

    rerender(<Call state="pending" />);
    expect(screen.queryByText("4 rows")).toBeNull();

    render(<Call state="done" />);
    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());
  });

  it("a reader can open a call that is still running", async () => {
    const user = userEvent.setup();
    render(<Call state="running" />);

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());
  });

  // The trap the wrapper exists for: Ark writes `open` / `closed` into `data-state` on the
  // machine's root, so the tool's own state has to live somewhere else or it replaces that one.
  it("keeps the call's state and the collapsible's apart", () => {
    // `running`, not `failed`. This read `failed` and expected `closed`, which was the defect
    // rather than the contract: a call that failed now opens itself, because the reason it failed
    // behind a click nobody knows to make is the worst place to put it. What the test is actually
    // for is unchanged — two `data-state` attributes, on two elements, that must never be one.
    render(<Call state="running" />);

    expect(root().getAttribute("data-state")).toBe("running");
    expect(collapsible().getAttribute("data-state")).toBe("closed");
  });

  it("the header's badge says the state, and carries it", () => {
    render(<Call state="running" />);

    const badge = document.querySelector("[data-slot=tool-badge]");
    expect(badge?.getAttribute("data-state")).toBe("running");
    expect(badge?.textContent).toContain("Running");
    expect(screen.getByRole("button").getAttribute("data-slot")).toBe("tool-header");
  });

  // The deliberate divergence: our input is a SQL statement and our output a table, so the payload
  // is composition. JSON is the default for a caller with nothing better, never the only option.
  it("draws the children it was given", async () => {
    render(<Call state="done" />);

    await waitFor(() => expect(screen.getByText("select count(*) from node")).not.toBeNull());
    const input = document.querySelector("[data-slot=tool-input]") as HTMLElement;
    expect(input.querySelector("[data-slot=json-tree-view]")).toBeNull();
  });

  it("falls back to a JSON tree when there is nothing better", async () => {
    render(
      <Tool state="done">
        <ToolHeader>query</ToolHeader>
        <ToolContent>
          <ToolInput data={{ table: "node", limit: 30 }} />
        </ToolContent>
      </Tool>,
    );

    const tree = await waitFor(() => {
      const found = document.querySelector("[data-slot=tool-input] [data-slot=json-tree-view]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(tree.textContent).toContain("table");
    expect(tree.textContent).toContain("node");
  });
});

describe("Tool opening on the transition", () => {
  // The one the file above does not cover: its "opens itself once there is a result" mounts a
  // FRESH tree at `done`, which the old `defaultOpen` also passed. This keeps one instance alive
  // across the change, which is the case that was broken — a call mounted the moment the model
  // plans it never opened again, `failed` included.
  it("opens when a live call settles, and stays shut once the reader has shut it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Call state="running" />);
    expect(screen.queryByText("4 rows")).toBeNull();

    rerender(<Call state="done" />);
    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.queryByText("4 rows")).toBeNull());
    rerender(<Call state="running" />);
    rerender(<Call state="done" />);
    expect(screen.queryByText("4 rows")).toBeNull();
  });

  it("opens a failed call, because the reason it failed is the thing to read", async () => {
    const { rerender } = render(<Call state="running" />);
    rerender(<Call state="failed" />);

    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());
  });
});
