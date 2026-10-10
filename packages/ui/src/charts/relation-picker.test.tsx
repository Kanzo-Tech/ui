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
      "Places part of this place",
      "Persons located in this place",
      "Posts located in this place",
      "Comments located in this place",
    ]);
    // The fan-out is each item's description; past ten per row it warns.
    expect(into.map((i) => i.textContent)).toEqual([
      "Places part of this place≤1 per Place",
      "Persons located in this place~1 per Place",
      "Posts located in this place~93 per Place",
      "Comments located in this place~103 per Place",
    ]);
    expect(into.map((i) => i.querySelector("[data-warn]") !== null)).toEqual([false, false, true, true]);
    expect(into[3]!.getAttribute("data-hop")).toBe("<isLocatedIn<Comment");
  });

  it("removes any chip, cutting the path there", async () => {
    const seen: Relation[] = [];
    render(<Picked seen={seen} />);
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Persons located in this place" }));
    expect(seen.at(-1)).toEqual({ root: "Place", path: [{ edge: "Person_isLocatedIn_Place", direction: "in" }] });
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Posts whose creator is this person" }));
    expect(seen.at(-1)!.path).toHaveLength(2);
    // The first chip goes, and the one after it with it.
    await userEvent.click(screen.getByRole("button", { name: "Remove Persons located in this place" }));
    expect(seen.at(-1)).toEqual({ root: "Place", path: [] });
  });

  it("states the grain: one row per the last type, how many, and which roots drop out", async () => {
    const { rerender } = render(<RelationPicker graph={GRAPH} onValueChange={() => {}} value={{ root: "Place", path: [] }} />);
    const grain = () => screen.getByRole("status").textContent;
    expect(grain()).toBe("One row per Place · 1,460 rows");
    rerender(<RelationPicker graph={GRAPH} onValueChange={() => {}} value={{ root: "Place", path: [{ edge: "Comment_isLocatedIn_Place", direction: "in" }] }} />);
    expect(grain()).toBe("One row per Comment · 151,043 rows · Places without comments are left out");
    rerender(
      <RelationPicker
        graph={GRAPH}
        onValueChange={() => {}}
        value={{
          root: "Place",
          path: [
            { edge: "Person_isLocatedIn_Place", direction: "in" },
            { edge: "Post_hasCreator_Person", direction: "in" },
          ],
        }}
      />,
    );
    // Past one hop the count is the fan-outs multiplied, and says so.
    expect(grain()).toBe("One row per Post · ~135,701 rows · Places without posts are left out");
    // A graph without counts states the grain alone.
    const bare: JoinGraph = { types: GRAPH.types.map((t) => ({ ...t, rows: undefined })), edges: GRAPH.edges.map((e) => ({ ...e, rows: undefined })) };
    rerender(<RelationPicker graph={bare} onValueChange={() => {}} value={{ root: "Place", path: [{ edge: "Comment_isLocatedIn_Place", direction: "in" }] }} />);
    expect(grain()).toBe("One row per Comment · Places without comments are left out");
  });

  it("lets a host phrase an edge and name a plural", async () => {
    render(
      <Picked
        phrase={(e, direction) => (e.source === e.destination ? (direction === "out" ? "The parent place" : "Its child places") : undefined)}
        plural={(name) => (name === "Person" ? "People" : undefined)}
        seen={[]}
      />,
    );
    await open();
    expect(await screen.findByRole("menuitem", { name: "The parent place" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Its child places" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "People located in this place" })).toBeTruthy();
  });
});
