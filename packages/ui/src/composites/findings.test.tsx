import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Diagnostic,
  DiagnosticActions,
  DiagnosticHeader,
  DiagnosticTitle,
} from "../simples/diagnostic.js";
import {
  type Finding,
  FindingsContent,
  FindingsGoTo,
  FindingsGroup,
  FindingsRoot,
  FindingsTrigger,
  useFinding,
} from "./findings.js";

interface Breach extends Finding {
  message: string;
  line: number;
}

const BREACHES: Breach[] = [
  { id: "a", variant: "warning", message: "The seal is faded", line: 9 },
  { id: "b", variant: "destructive", message: "Signed by three, not four", line: 4 },
  { id: "c", variant: "info", message: "The warden is on leave", line: 12 },
  { id: "d", variant: "destructive", message: "No date on the writ", line: 2 },
];

const Row = (breach: Breach) => (
  <Diagnostic variant={breach.variant}>
    <DiagnosticHeader>
      <DiagnosticTitle>{breach.message}</DiagnosticTitle>
      <DiagnosticActions>
        <FindingsGoTo>Go to line</FindingsGoTo>
      </DiagnosticActions>
    </DiagnosticHeader>
  </Diagnostic>
);

const renderFindings = (
  findings: Breach[],
  props: Partial<React.ComponentProps<typeof FindingsRoot<Breach>>> = {},
) =>
  render(
    <FindingsRoot findings={findings} {...props}>
      <FindingsTrigger>
        {({ destructive, warning, info }) =>
          destructive
            ? `${destructive} errors`
            : warning
              ? `${warning} warnings`
              : info
                ? `${info} notes`
                : "Valid"}
      </FindingsTrigger>
      <FindingsContent description="What the check found." title="Findings">
        <FindingsGroup title="Errors" variant="destructive">
          {Row}
        </FindingsGroup>
        <FindingsGroup title="Warnings" variant="warning">
          {Row}
        </FindingsGroup>
        <FindingsGroup title="Notes" variant="info">
          {Row}
        </FindingsGroup>
      </FindingsContent>
    </FindingsRoot>,
  );

const fireOpen = () => void userEvent.click(screen.getByRole("button", { name: "tally" }));

const open = async () => {
  await userEvent.click(screen.getByRole("button", { name: /errors|warnings|notes/i }));
  return screen.findByRole("dialog");
};

describe("the tally", () => {
  it("wears the worst finding's variant and says it in the caller's words", () => {
    renderFindings(BREACHES);
    const trigger = screen.getByRole("button", { name: "2 errors" });
    expect(trigger.getAttribute("data-variant")).toBe("destructive");
    expect(trigger.getAttribute("data-slot")).toBe("findings-trigger");
  });

  it("counts notes as notes, not as warnings", () => {
    renderFindings(BREACHES.filter((breach) => breach.variant === "info"));
    const trigger = screen.getByRole("button", { name: "1 notes" });
    expect(trigger.getAttribute("data-variant")).toBe("info");
  });

  it("is a success and not a control when nothing was found: there is no list to open", () => {
    renderFindings([]);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Valid").getAttribute("data-variant")).toBe("success");
  });

  it("falls back to the count when the caller gives no words", () => {
    render(
      <FindingsRoot findings={BREACHES}>
        <FindingsTrigger />
      </FindingsRoot>,
    );
    expect(screen.getByRole("button", { name: "4" })).toBeTruthy();
  });
});

describe("the list", () => {
  it("groups worst first, each group a named region counting its own, in the caller's order", async () => {
    renderFindings(BREACHES);
    const dialog = await open();

    const groups = within(dialog).getAllByRole("region");
    expect(groups.map((group) => group.getAttribute("data-variant"))).toEqual([
      "destructive",
      "warning",
      "info",
    ]);
    expect(within(dialog).getByRole("region", { name: "Errors 2" })).toBeTruthy();

    const errors = within(groups[0]!).getAllByRole("listitem");
    expect(errors.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Signed by three"),
      expect.stringContaining("No date"),
    ]);
  });

  it("draws no group for a variant nobody found", async () => {
    renderFindings(BREACHES.filter((breach) => breach.variant === "warning"));
    const dialog = await open();
    expect(within(dialog).getAllByRole("region")).toHaveLength(1);
    expect(within(dialog).queryByText("Errors")).toBeNull();
  });

  it("closes when the last finding goes", async () => {
    const { rerender } = render(
      <FindingsRoot findings={BREACHES}>
        <FindingsTrigger>tally</FindingsTrigger>
        <FindingsContent title="Findings" />
      </FindingsRoot>,
    );
    fireOpen();
    await screen.findByRole("dialog");
    rerender(
      <FindingsRoot findings={[]}>
        <FindingsTrigger>tally</FindingsTrigger>
        <FindingsContent title="Findings" />
      </FindingsRoot>,
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("going to a finding", () => {
  it("closes the list and hands the caller's own finding to onSelect", async () => {
    const onSelect = vi.fn();
    renderFindings(BREACHES, { onSelect });
    const dialog = await open();

    const [first] = within(dialog).getAllByRole("button", { name: "Go to line" });
    await userEvent.click(first!);

    expect(onSelect).toHaveBeenCalledWith(BREACHES[1]);
    expect(onSelect.mock.calls[0]![0].line).toBe(4);
    // Closed through Ark's exit, which unmounts on the animation's end rather than in the click.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("offers no control that goes nowhere", async () => {
    renderFindings(BREACHES);
    const dialog = await open();
    expect(within(dialog).queryByRole("button", { name: "Go to line" })).toBeNull();
  });

  it("gives a row of the caller's own the finding it is drawing", async () => {
    const Line = () => <span>line {useFinding<Breach>().line}</span>;
    render(
      <FindingsRoot defaultOpen findings={BREACHES}>
        <FindingsContent>
          <FindingsGroup title="Errors" variant="destructive">
            {() => (
              <li>
                <Line />
              </li>
            )}
          </FindingsGroup>
        </FindingsContent>
      </FindingsRoot>,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "line 4",
      "line 2",
    ]);
  });
});

describe("open state", () => {
  it("is Ark's: a host can hold it and hears every change", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <FindingsRoot findings={BREACHES} onOpenChange={onOpenChange} open={false}>
        <FindingsTrigger>tally</FindingsTrigger>
        <FindingsContent title="Findings" />
      </FindingsRoot>,
    );
    await userEvent.click(screen.getByRole("button", { name: "tally" }));
    expect(onOpenChange).toHaveBeenCalledWith(expect.objectContaining({ open: true }));
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(
      <FindingsRoot findings={BREACHES} onOpenChange={onOpenChange} open>
        <FindingsTrigger>tally</FindingsTrigger>
        <FindingsContent title="Findings" />
      </FindingsRoot>,
    );
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
