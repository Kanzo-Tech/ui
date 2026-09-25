import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormatByte, FormatNumber, FormatRelativeTime } from "./format";

describe("Format", () => {
  it("renders a byte size as text and nothing else", () => {
    const { container } = render(<FormatByte value={1_450_000} />);
    expect(container.innerHTML).toBe("1.45 MB");
  });

  it("passes Intl options through", () => {
    const { container } = render(<FormatNumber value={0.256} style="percent" />);
    expect(container.textContent).toBe("26%");
  });

  it("formats a date against now", () => {
    const { container } = render(<FormatRelativeTime value={new Date(Date.now() - 2 * 86_400_000)} />);
    expect(container.textContent).toBe("2 days ago");
  });
});
