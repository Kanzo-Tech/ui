import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type Finding, type FindingTally, groupFindings, tallyFindings } from "../lib/findings.js";
import { DiagnosticList } from "../simples/diagnostic.js";
import {
  type DescribePlace,
  FindingGroupRow,
  FindingRow,
  FindingsBadge,
  FindingsContent,
  FindingsGroup,
  FindingsRoot,
} from "./findings.js";

/** An RDF host's place. The library never reads it — only `describe` does. */
interface Node {
  focus: string;
  path: string;
}

const minCount = { id: "sh:MinCountConstraintComponent", label: "MinCount" };

const finding = (focus: string, path: string, severity: Finding["severity"] = "violation"): Finding<Node> => ({
  severity,
  message: `Every project states its ${path}, and this one is missing it entirely`,
  rule: minCount,
  place: { focus, path },
  help: "Add the value in the source table.",
});

const describeNode =
  (shown: string[] = []): DescribePlace<Node> =>
  (node) => ({
    where: `${node.path} · ${node.focus}`,
    action: { label: "Show", run: () => shown.push(node.focus) },
    detail: `“${node.focus}”`,
  });

const NOWRAP = /(^|\s)(whitespace-nowrap|truncate|text-nowrap)(\s|$)/;

describe("a finding row", () => {
  it("puts the message on a line of its own that wraps, and holds nothing to one line but the badge and the buttons", () => {
    const { container } = render(
      <DiagnosticList>
        <FindingRow describe={describeNode()} finding={finding("Project/123", "totalCost")} />
      </DiagnosticList>,
    );
    const row = screen.getByRole("listitem");
    expect(row.getAttribute("data-severity")).toBe("violation");

    const message = row.querySelector<HTMLElement>('[data-slot="finding-message"]')!;
    expect(message.textContent).toMatch(/missing it entirely/);
    expect(message.className).toMatch(/(^|\s)basis-full(\s|$)/);
    expect(message.className).toMatch(/(^|\s)whitespace-normal!(\s|$)/);

    const where = row.querySelector<HTMLElement>('[data-slot="finding-where"]')!;
    expect(where.textContent).toBe("totalCost · Project/123");
    expect(where.className).toMatch(/wrap-anywhere/);

    const badge = row.querySelector('[data-slot="diagnostic-severity"]')!;
    const heldToOneLine = [...container.querySelectorAll<HTMLElement>("*")].filter(
      (element) => NOWRAP.test(element.className) && element !== message,
    );
    // A button's label is a word or two the host chose; everything the data says may wrap.
    expect(heldToOneLine.filter((element) => element !== badge && element.tagName !== "BUTTON")).toEqual([]);
    expect(heldToOneLine).toContain(badge);
  });

  it("opens onto the place's detail, the rule and the help", async () => {
    render(
      <DiagnosticList>
        <FindingRow describe={describeNode()} finding={finding("Project/123", "totalCost")} />
      </DiagnosticList>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Details: totalCost · Project/123" }));
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("“Project/123”")).toBeTruthy();
    expect(row.querySelector('[data-slot="finding-rule"]')!.textContent).toBe("MinCount · sh:MinCountConstraintComponent");
    expect(within(row).getByText("Add the value in the source table.")).toBeTruthy();
  });

  it("says its severity in the host's words", () => {
    render(
      <DiagnosticList>
        <FindingRow
          describe={describeNode()}
          finding={finding("Project/1", "title", "warning")}
          labels={{ severity: { violation: "Infracción", warning: "Aviso", info: "Nota" } }}
        />
      </DiagnosticList>,
    );
    expect(screen.getByText("Aviso")).toBeTruthy();
  });
});

describe("a group row", () => {
  const findings = Array.from({ length: 362 }, (_, i) => finding(`Project/${i}`, "totalCost"));
  const [group] = groupFindings(findings, (f) => `${f.rule.id}|${f.place.path}`);

  it("carries its count on the badge and opens onto the sample, each place with its own action", async () => {
    const shown: string[] = [];
    const all = vi.fn();
    render(
      <DiagnosticList>
        <FindingGroupRow
          action={{ label: "Show 362", run: all }}
          describe={describeNode(shown)}
          group={group!}
          where="totalCost"
        />
      </DiagnosticList>,
    );
    const row = screen.getAllByRole("listitem")[0]!;
    expect(row.getAttribute("data-count")).toBe("362");
    expect(row.querySelector('[data-slot="diagnostic-severity"]')!.textContent).toBe("Violation362");

    await userEvent.click(screen.getByRole("button", { name: "Show 362" }));
    expect(all).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Details: totalCost" }));
    const sample = row.querySelector<HTMLElement>('[data-slot="finding-sample"]')!;
    expect(within(sample).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "totalCost · Project/0Show",
      "totalCost · Project/1Show",
      "totalCost · Project/2Show",
    ]);
    await userEvent.click(within(sample).getAllByRole("button", { name: "Show" })[1]!);
    expect(shown).toEqual(["Project/1"]);
  });
});

describe("a group of rows", () => {
  it("is a region named by its title, with the tally beside the name rather than in it", () => {
    const tally: FindingTally = { violation: 12, warning: 3, info: 0, total: 15 };
    render(
      <FindingsGroup tally={tally} title="ProjectShape">
        <FindingRow describe={describeNode()} finding={finding("Project/1", "title")} />
      </FindingsGroup>,
    );
    const region = screen.getByRole("region", { name: "ProjectShape" });
    const counts = region.querySelector('[data-slot="findings-tally"]')!;
    expect(counts.textContent).toBe("Violation 12Warning 3");
    expect(within(region).getAllByRole("listitem")).toHaveLength(1);
  });
});

const Popover = ({
  tally,
  onOpenChange,
  open,
}: {
  tally: FindingTally | undefined;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) => {
  const shown: string[] = [];
  return (
    <FindingsRoot onOpenChange={onOpenChange && ((d) => onOpenChange(d.open))} open={open} tally={tally}>
      <FindingsBadge>
        {(t) =>
          !t ? "No rules" : t.total === 0 ? "Valid" : `${t.violation} violations · ${t.warning} warnings`}
      </FindingsBadge>
      <FindingsContent empty={<p>Nothing to show.</p>} header={<p>shapes.ttl</p>}>
        <FindingsGroup tally={tally ?? tallyFindings([])} title="ProjectShape">
          <FindingRow describe={describeNode(shown)} finding={finding("Project/1", "title")} />
        </FindingsGroup>
      </FindingsContent>
    </FindingsRoot>
  );
};

describe("the badge", () => {
  it("is a button named by the host's tally in every state, painted by the worst", () => {
    const { rerender } = render(<Popover tally={{ violation: 362, warning: 17364, info: 0, total: 17726 }} />);
    const badge = screen.getByRole("button", { name: "362 violations · 17364 warnings" });
    expect(badge.getAttribute("data-variant")).toBe("destructive");
    expect(badge.getAttribute("data-slot")).toBe("findings-badge");

    rerender(<Popover tally={{ violation: 0, warning: 2, info: 0, total: 2 }} />);
    expect(screen.getByRole("button", { name: "0 violations · 2 warnings" }).getAttribute("data-variant")).toBe(
      "warning",
    );

    rerender(<Popover tally={tallyFindings([])} />);
    expect(screen.getByRole("button", { name: "Valid" }).getAttribute("data-variant")).toBe("success");

    rerender(<Popover tally={undefined} />);
    expect(screen.getByRole("button", { name: "No rules" }).getAttribute("data-variant")).toBe("outline");
  });

  it("shows the empty slot, and not the list, when nothing was found or nothing was checked", async () => {
    render(<Popover tally={undefined} />);
    await userEvent.click(screen.getByRole("button", { name: "No rules" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("shapes.ttl")).toBeTruthy();
    expect(within(dialog).getByText("Nothing to show.")).toBeTruthy();
    expect(within(dialog).queryByRole("region")).toBeNull();
  });

  it("closes the popover before it runs a place's action", async () => {
    render(<Popover tally={{ violation: 1, warning: 0, info: 0, total: 1 }} />);
    await userEvent.click(screen.getByRole("button", { name: "1 violations · 0 warnings" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("region", { name: "ProjectShape" })).toBeTruthy();
    expect(within(dialog).queryByText("Nothing to show.")).toBeNull();

    await userEvent.click(within(dialog).getByRole("button", { name: "Show" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("lists in a vertical-only area, so a long line cannot widen the popover", async () => {
    render(<Popover tally={{ violation: 1, warning: 0, info: 0, total: 1 }} />);
    await userEvent.click(screen.getByRole("button", { name: /violations/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="scroll-area"]')!.getAttribute("data-orientation")).toBe("vertical");
  });

  it("keeps the open state Ark's: a host can hold it and hears every change", async () => {
    const onOpenChange = vi.fn();
    const tally = { violation: 1, warning: 0, info: 0, total: 1 };
    const { rerender } = render(<Popover onOpenChange={onOpenChange} open={false} tally={tally} />);
    await userEvent.click(screen.getByRole("button", { name: /violations/ }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<Popover onOpenChange={onOpenChange} open tally={tally} />);
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
