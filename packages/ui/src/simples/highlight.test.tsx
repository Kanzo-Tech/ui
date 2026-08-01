import { render, screen } from "@testing-library/react";
import { useHighlight as useArkHighlight } from "@ark-ui/react/highlight";
import { describe, expect, it } from "vitest";
import { Highlight, useHighlight } from "./highlight.js";

describe("useHighlight", () => {
  // The one `useX` in `simples/` that is Ark's *machine* hook rather than a context alias, which is
  // how Shark binds it too. Asserted against Ark directly because the parity guard compares names
  // and never bindings — the `useTagsInput` mismatch is what that blind spot cost.
  it("is Ark's machine hook, not a context alias", () => {
    expect(useHighlight).toBe(useArkHighlight);
  });

  it("returns the chunks Highlight renders, flagged by match", () => {
    const Matches = () => {
      const chunks = useHighlight({ text: "Ark UI + Tailwind", query: "Ark" });

      return <span>{chunks.filter((chunk) => chunk.match).map((chunk) => chunk.text).join()}</span>;
    };

    render(<Matches />);

    expect(screen.getByText("Ark")).not.toBeNull();
  });
});

describe("Highlight", () => {
  it("wraps a match in a token-themed mark", () => {
    render(<Highlight query="token" text="a token-themed mark" />);

    const mark = screen.getByText("token");

    expect(mark.tagName).toBe("MARK");
    expect(mark.className).toContain("bg-match");
  });
});
