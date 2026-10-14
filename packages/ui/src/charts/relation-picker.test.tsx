import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JoinGraph, Relation } from "@kanzo-tech/mosaic";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RelationPicker, type RelationPickerProps } from "./relation-picker.js";

// LDBC SNB's places, with the record counts its seed loads.
const type = (name: string, rows: number) => ({ name, table: name, key: "dense_id", columns: ["name"], rows });
const edge = (source: string, label: string, destination: string, rows: number) => ({
  name: `${source}_${label}_${destination}`,
  label,
  source,
  destination,
  table: `${source}_${label}_${destination}`,
  src: "src",
  dst: "dst",
  rows,
});
const GRAPH: JoinGraph = {
  types: [type("Place", 1460), type("Comment", 151043), type("Post", 135701), type("Person", 1528)],
  edges: [
    edge("Place", "isPartOf", "Place", 1454),
    edge("Comment", "isLocatedIn", "Place", 151043),
    edge("Post", "isLocatedIn", "Place", 135701),
    edge("Person", "isLocatedIn", "Place", 1528),
    edge("Post", "hasCreator", "Person", 135701),
  ],
};

function Picked({ seen, start = { root: "Place", path: [] }, ...props }: { seen: Relation[]; start?: Relation } & Partial<RelationPickerProps>) {
  const [value, setValue] = useState<Relation>(start);
  return (
    <RelationPicker
      graph={GRAPH}
      onValueChange={(next) => {
        seen.push(next);
        setValue(next);
      }}
      value={value}
      {...props}
    />
  );
}

const open = () => userEvent.click(screen.getByRole("button", { name: "Add related…" }));
const items = (group: string) => within(screen.getByRole("group", { name: group })).getAllByRole("menuitem");

describe("RelationPicker", () => {
  it("reads each hop as a sentence, grouped by direction and sorted by fan-out", async () => {
    render(<Picked seen={[]} />);
    await open();
    expect((await screen.findAllByRole("group", { name: "Follow from each Place" })).length).toBe(1);
    expect(items("Follow from each Place").map((i) => i.getAttribute("aria-label"))).toEqual(["The place it is part of"]);
    const into = items("Bring in what points at it");
    expect(into.map((i) => i.getAttribute("aria-label"))).toEqual([
      "Place · part of this place",
      "Person · located in this place",
      "Post · located in this place",
      "Comment · located in this place",
    ]);
    // The fan-out is each item's description; past ten per row it warns.
    expect(into.map((i) => i.textContent)).toEqual([
      "Place · part of this place≤1 per Place",
      "Person · located in this place~1 per Place",
      "Post · located in this place~93 per Place",
      "Comment · located in this place~103 per Place",
    ]);
    expect(into.map((i) => i.querySelector("[data-warn]") !== null)).toEqual([false, false, true, true]);
    expect(into[3]!.getAttribute("data-hop")).toBe("<isLocatedIn<Comment");
  });

  it("removes any chip, cutting the path there", async () => {
    const seen: Relation[] = [];
    render(<Picked seen={seen} />);
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Person · located in this place" }));
    expect(seen.at(-1)).toEqual({ root: "Place", path: [{ edge: "Person_isLocatedIn_Place", direction: "in" }] });
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Post · whose creator is this person" }));
    expect(seen.at(-1)!.path).toHaveLength(2);
    // The first chip goes, and the one after it with it.
    await userEvent.click(screen.getByRole("button", { name: "Remove Person · located in this place" }));
    expect(seen.at(-1)).toEqual({ root: "Place", path: [] });
  });

  it("lets a host phrase an edge, and words every sentence through its translations", async () => {
    render(
      <Picked
        phrase={(e, direction) => (e.source === e.destination ? (direction === "out" ? "The parent place" : "Its child places") : undefined)}
        seen={[]}
        translations={{
          add: "Añadir relacionado…",
          bringIn: "Traer lo que apunta aquí",
          in: (source, label, destination) => `${source} · ${label} → ${destination}`,
          perRow: (count, from) => `${count} por ${from}`,
        }}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Añadir relacionado…" }));
    expect(await screen.findByRole("menuitem", { name: "The parent place" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Its child places" })).toBeTruthy();
    const into = items("Traer lo que apunta aquí");
    expect(into[1]?.textContent).toBe("person · is located in → place~1 por Place");
  });
});
