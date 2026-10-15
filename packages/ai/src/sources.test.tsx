import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Source, Sources, SourcesContent, SourcesTrigger } from "./sources.js";

const block = (props: { defaultOpen?: boolean } = {}) => (
  <Sources {...props}>
    <SourcesTrigger count={2} />
    <SourcesContent>
      <p>Grants awarded by year.</p>
      <Source>Contracts · 3</Source>
      <Source>Prizes · 1</Source>
    </SourcesContent>
  </Sources>
);

describe("Sources", () => {
  it("is a trigger naming the block and counting its sources, closed until pressed", async () => {
    const user = userEvent.setup();
    render(block());
    const trigger = screen.getByRole("button", { name: /Sources/ });
    expect(trigger.textContent).toContain("2");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Contracts · 3")).toBeNull();

    await user.click(trigger);
    expect(screen.getByText("Grants awarded by year.")).toBeTruthy();
    expect(screen.getByText("Contracts · 3").getAttribute("data-slot")).toBe("source");
  });

  it("opens by default when asked, and says its word in the host's language", () => {
    render(
      <Sources defaultOpen>
        <SourcesTrigger count={1} translations={{ sources: "Fuentes" }} />
        <SourcesContent>
          <Source>Contratos · 3</Source>
        </SourcesContent>
      </Sources>,
    );
    expect(screen.getByRole("button", { name: /Fuentes/ })).toBeTruthy();
    expect(screen.getByText("Contratos · 3")).toBeTruthy();
  });
});
