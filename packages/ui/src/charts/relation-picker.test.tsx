import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JoinGraph, Relation } from "@kanzo-tech/mosaic";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RelationPicker } from "./relation-picker.js";

const GRAPH: JoinGraph = {
  types: [
    { name: "Person", table: "Person", key: "dense_id", columns: ["country"] },
    { name: "Post", table: "Post", key: "dense_id", columns: ["length"] },
  ],
  edges: [
    { name: "Post_hasCreator_Person", label: "hasCreator", source: "Post", destination: "Person", table: "e", src: "src", dst: "dst" },
  ],
};

function Picked({ seen }: { seen: Relation[] }) {
  const [value, setValue] = useState<Relation>({ root: "Person", path: [] });
  return (
    <RelationPicker
      graph={GRAPH}
      onValueChange={(next) => {
        seen.push(next);
        setValue(next);
      }}
      value={value}
    />
  );
}

describe("RelationPicker", () => {
  it("takes a hop along an edge leaving the last type, and takes it back", async () => {
    const seen: Relation[] = [];
    render(<Picked seen={seen} />);
    await userEvent.click(screen.getByRole("button", { name: "Hop" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "← hasCreator · Post" }));
    expect(seen.at(-1)).toEqual({ root: "Person", path: [{ edge: "Post_hasCreator_Person", direction: "in" }] });
    expect(screen.getByRole("group", { name: "Relation" }).textContent).toContain("hasCreator");
    // Post has an edge out, back to Person, so the path can go on.
    expect(screen.getByRole("button", { name: "Hop" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove the hop to Post" }));
    expect(seen.at(-1)).toEqual({ root: "Person", path: [] });
  });
});
