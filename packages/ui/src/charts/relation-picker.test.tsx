import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Pattern } from "@kanzo-tech/graphar-duckdb";
import { graphOf } from "../../test/graph";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RelationPicker, variableFor, type RelationPickerProps } from "./relation-picker.js";

// LDBC SNB's places, with the record counts its seed loads.
const type = (name: string, count: number) => ({ type: name, count, properties: [{ name: "name", type: "VARCHAR" }] });
const edge = (srcType: string, edgeType: string, dstType: string, count: number) => ({ srcType, edgeType, dstType, count });
const GRAPH = graphOf(
  [type("Place", 1460), type("Comment", 151043), type("Post", 135701), type("Person", 1528)],
  [
    edge("Place", "isPartOf", "Place", 1454),
    edge("Comment", "isLocatedIn", "Place", 151043),
    edge("Post", "isLocatedIn", "Place", 135701),
    edge("Person", "isLocatedIn", "Place", 1528),
    edge("Post", "hasCreator", "Person", 135701),
  ],
);

function Picked({ seen, start = [{ as: "place", type: "Place" }], ...props }: { seen: Pattern[]; start?: Pattern } & Partial<RelationPickerProps>) {
  const [value, setValue] = useState<Pattern>(start);
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
    expect(items("Follow from each Place").map((i) => i.getAttribute("aria-label"))).toEqual(["isPartOf → Place"]);
    const into = items("Bring in what points at it");
    expect(into.map((i) => i.getAttribute("aria-label"))).toEqual([
      "Place isPartOf → this Place",
      "Person isLocatedIn → this Place",
      "Post isLocatedIn → this Place",
      "Comment isLocatedIn → this Place",
    ]);
    // The fan-out is each item's description; past ten per row it warns.
    expect(into.map((i) => i.textContent)).toEqual([
      "Place isPartOf → this Place≤1 per Place",
      "Person isLocatedIn → this Place~1 per Place",
      "Post isLocatedIn → this Place~93 per Place",
      "Comment isLocatedIn → this Place~103 per Place",
    ]);
    expect(into.map((i) => i.querySelector("[data-warn]") !== null)).toEqual([false, false, true, true]);
    expect(into[3]!.getAttribute("data-hop")).toBe("<isLocatedIn<Comment");
  });

  it("walks a pattern, naming every vertex so its properties are fields, and removes any chip, cutting the path there", async () => {
    const seen: Pattern[] = [];
    render(<Picked seen={seen} />);
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Person isLocatedIn → this Place" }));
    expect(seen.at(-1)).toEqual([
      { as: "place", type: "Place" },
      { edge: "isLocatedIn", direction: "in" },
      { as: "person", type: "Person" },
    ]);
    await open();
    await userEvent.click(await screen.findByRole("menuitem", { name: "Post hasCreator → this Person" }));
    expect(seen.at(-1)).toHaveLength(5);
    // The first chip goes, and the one after it with it.
    await userEvent.click(screen.getByRole("button", { name: "Remove Person isLocatedIn → this Place" }));
    expect(seen.at(-1)).toEqual([{ as: "place", type: "Place" }]);
  });

  it("names a second vertex of a type apart from the first", () => {
    expect(variableFor([{ as: "place", type: "Place" }, { edge: "isPartOf" }], "Place")).toBe("place2");
    expect(variableFor([], "Person")).toBe("person");
  });

  it("lets a host phrase an edge, and words every sentence through its translations", async () => {
    render(
      <Picked
        phrase={(e, direction) => (e.srcType === e.dstType ? (direction === "out" ? "The parent place" : "Its child places") : undefined)}
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
    expect(into[1]?.textContent).toBe("Person · isLocatedIn → Place~1 por Place");
  });
});
