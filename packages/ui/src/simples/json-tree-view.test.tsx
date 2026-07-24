import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonTreeView } from "./json-tree-view.js";

describe("JsonTreeView", () => {
  it("tags the root and tree parts and renders the JSON keys", () => {
    const { container } = render(
      <JsonTreeView data={{ name: "kanzo", nested: { count: 2 } }} />
    );

    expect(
      container.querySelector("[data-slot=json-tree-view]")
    ).toBeTruthy();
    expect(
      container.querySelector("[data-slot=json-tree-view-tree]")
    ).toBeTruthy();
    expect(container.textContent).toContain("name");
  });
});
