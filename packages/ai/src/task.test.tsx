import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Task, TaskList, TaskStatus, TaskTitle } from "./task.js";

// keasy's `phase` — generating, executing, explaining, done — is exactly this shape: named steps,
// one of which is running.
const Phases = () => (
  <TaskList>
    <Task state="done">
      <TaskStatus />
      <TaskTitle>Generating SQL</TaskTitle>
    </Task>
    <Task state="running">
      <TaskStatus />
      <TaskTitle>Executing</TaskTitle>
    </Task>
    <Task state="pending">
      <TaskStatus />
      <TaskTitle>Explaining</TaskTitle>
    </Task>
  </TaskList>
);

describe("Task", () => {
  it("is a list of steps, each declaring its state once", () => {
    render(<Phases />);

    const steps = screen.getAllByRole("listitem");
    expect(steps.map((step) => step.getAttribute("data-state"))).toEqual([
      "done",
      "running",
      "pending",
    ]);
    expect(steps.map((step) => step.textContent)).toEqual([
      "DoneGenerating SQL",
      "RunningExecuting",
      "PendingExplaining",
    ]);
  });

  // The dot is `aria-hidden` and so is the spinner, so without the word the state is a colour and
  // nothing else.
  it("says the state in words, and lets the caller choose the words", () => {
    render(
      <TaskList>
        <Task state="failed">
          <TaskStatus>Could not run</TaskStatus>
          <TaskTitle>Executing</TaskTitle>
        </Task>
      </TaskList>,
    );

    const step = screen.getByRole("listitem");
    expect(within(step).getByText("Could not run")).not.toBeNull();
    expect(within(step).queryByText("Failed")).toBeNull();
  });

  it("draws a spinner while a step runs and a still mark otherwise", () => {
    render(<Phases />);

    const [done, running] = screen.getAllByRole("listitem");
    // The marks are decorative — hence the DOM query rather than a role — which is exactly why the
    // word beside them is not optional. A settled step draws an icon and no spinner; what it must
    // NOT draw is `Status`, whose `ring-2 ring-background` halo cut the rail these stand on.
    expect((running as HTMLElement).querySelector("[data-slot=spinner]")).not.toBeNull();
    expect((done as HTMLElement).querySelector("svg")).not.toBeNull();
    expect((done as HTMLElement).querySelector("[data-slot=spinner]")).toBeNull();
    expect((done as HTMLElement).querySelector("[data-slot=status-indicator]")).toBeNull();
  });

  it("defaults to pending, and names its parts", () => {
    render(
      <TaskList>
        <Task>
          <TaskStatus />
          <TaskTitle>Waiting</TaskTitle>
        </Task>
      </TaskList>,
    );

    const step = screen.getByRole("listitem");
    expect(step.getAttribute("data-state")).toBe("pending");
    expect(step.getAttribute("data-slot")).toBe("task");
    expect(step.parentElement?.getAttribute("data-slot")).toBe("task-list");
    expect(
      step.querySelector("[data-slot=task-status]")?.getAttribute("data-state"),
    ).toBe("pending");
    expect(step.querySelector("[data-slot=task-title]")?.textContent).toBe("Waiting");
  });
});
