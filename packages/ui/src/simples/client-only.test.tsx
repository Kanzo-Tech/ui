import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClientOnly } from "./client-only.js";

describe("ClientOnly", () => {
  it("renders children once mounted", () => {
    render(
      <ClientOnly fallback={<span>loading</span>}>
        <span>mounted</span>
      </ClientOnly>
    );

    expect(screen.getByText("mounted")).toBeTruthy();
  });
});
