import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Show } from "./show.js";

describe("Show", () => {
  it("renders children when `when` is truthy", () => {
    render(
      <Show fallback={<span>fallback</span>} when>
        <span>content</span>
      </Show>
    );

    expect(screen.getByText("content")).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("renders fallback when `when` is falsy", () => {
    render(
      <Show fallback={<span>fallback</span>} when={false}>
        <span>content</span>
      </Show>
    );

    expect(screen.getByText("fallback")).toBeTruthy();
    expect(screen.queryByText("content")).toBeNull();
  });
});
