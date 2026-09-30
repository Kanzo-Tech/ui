import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field.js";
import {
  SegmentGroup,
  SegmentGroupItem,
  SegmentGroupItemText,
} from "./segment-group.js";

describe("SegmentGroup options", () => {
  it("renders one item per option", () => {
    render(
      <SegmentGroup
        aria-label="Side"
        options={[
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ]}
      />,
    );

    expect(screen.getByRole("radio", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "End" })).toBeTruthy();
  });

  it("renders options before explicit children (additive)", () => {
    render(
      <SegmentGroup
        aria-label="Mixed"
        options={[{ value: "a", label: "A" }]}
      >
        <SegmentGroupItem value="b">
          <SegmentGroupItemText>B</SegmentGroupItemText>
        </SegmentGroupItem>
      </SegmentGroup>,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    // Option `A` is rendered ahead of the explicit child `B`.
    expect(radios[0]?.getAttribute("value")).toBe("a");
    expect(radios[1]?.getAttribute("value")).toBe("b");
  });

  it("propagates a disabled option", () => {
    render(
      <SegmentGroup
        aria-label="WithDisabled"
        options={[
          { value: "on", label: "On" },
          { value: "off", label: "Off", disabled: true },
        ]}
      />,
    );

    expect((screen.getByRole("radio", { name: "Off" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "On" }) as HTMLInputElement).disabled).toBe(false);
  });
});

describe("SegmentGroup field state", () => {
  const options = [
    { value: "start", label: "Start" },
    { value: "end", label: "End" },
  ];
  const root = () => document.querySelector("[data-slot=segment-group]");

  it("inherits `disabled` and `invalid` from an ancestor Field", () => {
    render(
      <Field disabled invalid>
        <SegmentGroup aria-label="Side" defaultValue="start" options={options} />
      </Field>,
    );

    expect(root()?.hasAttribute("data-disabled")).toBe(true);
    expect(root()?.hasAttribute("data-invalid")).toBe(true);
    expect((screen.getByRole("radio", { name: "Start" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("lets an explicit prop override the Field", () => {
    render(
      <Field invalid>
        <SegmentGroup aria-label="Side" invalid={false} options={options} />
      </Field>,
    );

    expect(root()?.hasAttribute("data-invalid")).toBe(false);
  });

  it("stays enabled with no Field ancestor", () => {
    render(<SegmentGroup aria-label="Side" options={options} />);

    expect(root()?.hasAttribute("data-disabled")).toBe(false);
    expect((screen.getByRole("radio", { name: "Start" }) as HTMLInputElement).disabled).toBe(false);
  });
});
