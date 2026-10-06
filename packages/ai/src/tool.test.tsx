import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput, type ToolPart } from "./tool.js";

/** A `query` call as the AI SDK streams it, at a given state. */
const part = (state: ToolPart["state"]): ToolPart =>
  ({
    type: "tool-query",
    toolCallId: "1",
    state,
    input: { sql: "select count(*) from node" },
    ...(state === "output-available" ? { output: { rows: 4 } } : {}),
    ...(state === "output-error" ? { errorText: "no such table: node" } : {}),
  }) as ToolPart;

const Call = (props: { state: ToolPart["state"] }) => (
  <Tool part={part(props.state)}>
    <ToolHeader />
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
  it("names itself after the tool, from the part", () => {
    render(<Call state="input-available" />);
    expect(screen.getByRole("button").textContent).toContain("query");
  });

  it("opens itself once there is a result, and not before", async () => {
    render(<Call state="input-available" />);
    expect(screen.queryByText("4 rows")).toBeNull();

    render(<Call state="output-available" />);
    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());
  });

  // Ark writes `open` / `closed` into `data-state` on the machine's root, so the tool's own state
  // has to live somewhere else or it replaces that one.
  it("keeps the call's state and the collapsible's apart", () => {
    render(<Call state="input-available" />);
    expect(root().getAttribute("data-state")).toBe("input-available");
    expect(collapsible().getAttribute("data-state")).toBe("closed");
  });

  it("draws the AI SDK's state in its badge", () => {
    const { rerender } = render(<Call state="input-streaming" />);
    const badge = () => document.querySelector("[data-slot=tool-badge]") as HTMLElement;
    expect(badge().textContent).toContain("Preparing");
    rerender(<Call state="approval-requested" />);
    expect(badge().textContent).toContain("Awaiting approval");
    rerender(<Call state="output-denied" />);
    expect(badge().textContent).toContain("Denied");
  });

  it("reads Stopped, and still, for a call that will never settle; a settled one keeps its state", () => {
    const { rerender } = render(<Tool part={part("input-available")} stopped />);
    const badge = () => document.querySelector("[data-slot=tool-badge]") as HTMLElement;
    expect(badge().textContent).toContain("Stopped");
    expect(badge().querySelector("[data-slot=spinner]")).toBeNull();
    expect(root().getAttribute("data-stopped")).toBe("true");
    rerender(<Tool part={part("output-available")} stopped />);
    expect(badge().textContent).toContain("Done");
  });

  it("falls back to the default frame and a JSON tree when given nothing", async () => {
    render(<Tool part={part("output-available")} />);
    const tree = await waitFor(() => {
      const found = document.querySelector("[data-slot=tool-input] [data-slot=json-tree-view]");
      expect(found).not.toBeNull();
      return found as HTMLElement;
    });
    expect(tree.textContent).toContain("sql");
  });

  it("shows why a call failed, from the part's error", async () => {
    render(<Tool part={part("output-error")} />);
    await waitFor(() => expect(screen.getByText("no such table: node")).not.toBeNull());
  });
});

describe("Tool opening on the transition", () => {
  it("opens when a live call settles, and stays shut once the reader has shut it", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Call state="input-available" />);
    expect(screen.queryByText("4 rows")).toBeNull();

    rerender(<Call state="output-available" />);
    await waitFor(() => expect(screen.getByText("4 rows")).not.toBeNull());

    await user.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.queryByText("4 rows")).toBeNull());
    rerender(<Call state="input-available" />);
    rerender(<Call state="output-available" />);
    expect(screen.queryByText("4 rows")).toBeNull();
  });
});
