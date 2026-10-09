import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Selection } from "@kanzo-tech/mosaic";
import { autoDashboard, MosaicProvider, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { ToolPart } from "../tool.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { AnswerCard } from "./answer-card.js";
import type { AnswerRelation } from "./answer.js";
import { readAnswerRelations } from "./relations.js";

let db: TestDatabase;
let person: AnswerRelation;
let output: AnswerOutput;

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  [person] = (await readAnswerRelations(db.coordinator, PEOPLE, [PERSON])) as [AnswerRelation];
  const agent = dataAgent({ model: mockModel(() => "").model, coordinator: db.coordinator, graph: PEOPLE, relations: [person] });
  const input = {
    relation: PERSON,
    where: [{ field: "Person.gender", in: ["female"] }],
    show: { kind: "stat", measure: { op: "avg", field: "Person.age" } },
  };
  output = (await agent.tools.answer.execute!(input as never, { toolCallId: "c", messages: [] } as never)) as AnswerOutput;
});

const answered = (kept: AnswerOutput) =>
  ({ type: "tool-answer", toolCallId: "c", state: "output-available", input: {}, output: kept }) as ToolPart;
const at = (state: ToolPart["state"], extra: object = {}) => ({ type: "tool-answer", toolCallId: "c", state, input: {}, ...extra }) as ToolPart;

function page(crossfilter = Selection.crossfilter()) {
  return ({ children }: { children: React.ReactNode }) => (
    <MosaicProvider coordinator={db.coordinator} crossfilter={crossfilter}>
      {children}
    </MosaicProvider>
  );
}

describe("AnswerCard", () => {
  it("Add to the dashboard writes the tile into the relation's spec", async () => {
    const onAdd = vi.fn<(key: string, add: (spec: DashboardSpec | undefined) => DashboardSpec) => void>();
    render(<AnswerCard graph={PEOPLE} onAdd={onAdd} part={answered(output)} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const [key, add] = onAdd.mock.calls[0]!;
    expect(key).toBe("Person");
    const { id, ...tile } = output.answer.show;

    // A relation nobody has edited: the automatic dashboard, as `Dashboard` draws it, then the tile.
    const auto = autoDashboard(person.fields);
    const first = add(undefined);
    expect(first.tiles.slice(0, -1)).toEqual(auto.tiles);
    expect(first.tiles.at(-1)).toEqual({ ...tile, id: expect.any(String) });
    expect(first.tiles.at(-1)!.id).not.toBe(id);

    const saved: DashboardSpec = { filters: [{ field: "Person.age" }], tiles: [{ id: "mine", kind: "stat", measure: { op: "count" } }] };
    expect(add(saved)).toEqual({ filters: saved.filters, tiles: [saved.tiles[0], { ...tile, id: expect.any(String) }] });
    expect(screen.getByRole("button", { name: "✓ On the dashboard" })).toHaveProperty("disabled", true);
  });

  it("filters the page to the answer as one semi-join on the root key, and takes it back", async () => {
    const crossfilter = Selection.crossfilter();
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page(crossfilter) });
    await userEvent.click(await screen.findByRole("button", { name: "Filter to it" }));
    expect(crossfilter.clauses).toHaveLength(1);
    expect(String(crossfilter.predicate(null))).toContain(`"dense_id" IN (SELECT "dense_id" FROM`);
    expect(String(crossfilter.predicate(null))).toContain(`"Person.gender" IN ('female')`);
    const pressed = await screen.findByRole("button", { name: "✓ Filtered to it" });
    expect(pressed.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(pressed);
    expect(crossfilter.clauses.filter((c) => c.predicate != null)).toHaveLength(0);
  });

  it("is busy until answered, over a skeleton the chart's height, and not once stopped", () => {
    const { rerender } = render(<AnswerCard graph={PEOPLE} part={at("input-streaming")} />, { wrapper: page() });
    expect(document.querySelector("[data-slot=answer-card]")?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("[data-slot=answer-card-pending]")?.className).toContain("h-[220px]");
    rerender(<AnswerCard graph={PEOPLE} part={at("input-available")} stopped />);
    expect(document.querySelector("[data-slot=answer-card]")?.hasAttribute("aria-busy")).toBe(false);
    expect(document.querySelector("[data-slot=answer-card-pending]")).toBeNull();
  });

  it("draws a refusal as a Problem under the card's title", () => {
    render(<AnswerCard graph={PEOPLE} part={at("output-error", { errorText: "show.x: secret is not a field of Person." })} />, { wrapper: page() });
    const problem = document.querySelector("[data-slot=diagnostic]");
    expect(problem?.textContent).toContain("The answer failed");
    expect(problem?.textContent).toContain("show.x: secret is not a field of Person.");
  });

  it("draws a kept answer whose relation the graph no longer has as a Problem", () => {
    render(<AnswerCard graph={{ types: PEOPLE.types, edges: [] }} part={answered({ ...output, answer: { ...output.answer, relation: { root: "Post", path: [] } } })} />, {
      wrapper: page(),
    });
    expect(document.querySelector("[data-slot=diagnostic]")?.textContent).toContain("the join graph has no type Post");
  });

  it("draws the figure the answer is, read under its conditions", async () => {
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=stat-value]")?.textContent).toBe("34"));
  });
});
