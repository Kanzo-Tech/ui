import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LlmError } from "@kanzo-tech/llm";
import { ModelBadge } from "./model-badge.js";

describe("ModelBadge", () => {
  it("says where the model stands in a badge that is a button, the percentage while it loads", () => {
    const { rerender } = render(<ModelBadge load={{ state: "loading", progress: 0.42, text: "Fetching param cache[3/10]" }} />);
    expect(screen.getByRole("button", { name: "Preparing the model · 42%" }).getAttribute("data-variant")).toBe("info");
    rerender(<ModelBadge load={{ state: "ready" }} />);
    expect(screen.getByRole("button", { name: "Model ready" }).getAttribute("data-variant")).toBe("success");
    rerender(<ModelBadge load={{ state: "idle" }} />);
    expect(screen.getByRole("button", { name: "Model" }).getAttribute("data-variant")).toBe("outline");
  });

  it("opens the bar and the engine's words while it loads", async () => {
    render(<ModelBadge load={{ state: "loading", progress: 0.42, text: "Fetching param cache[3/10]" }} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Preparing the model · 42%" }));
    expect((await screen.findByRole("progressbar")).getAttribute("aria-valuenow")).toBe("42");
    expect(screen.getByText("Fetching param cache[3/10]")).not.toBeNull();
  });

  it("opens a failure as a Problem, with a retry only where the device can recover", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    const failed = { code: "llm/failed", message: "The download stopped" };
    const { unmount } = render(<ModelBadge load={{ state: "failed", error: failed }} onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Model failed" }));
    expect(await screen.findByText("The download stopped")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    unmount();
    const unavailable = new LlmError("llm/unavailable", "This browser cannot run it: it has no WebGPU", { reason: "webgpu" });
    render(<ModelBadge load={{ state: "failed", error: unavailable }} onRetry={onRetry} />);
    await user.click(screen.getByRole("button", { name: "Model failed" }));
    expect(await screen.findByText(/no WebGPU/)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});
