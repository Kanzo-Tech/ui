import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Selection } from "@kanzo-tech/mosaic";
import { autoDashboard, MosaicProvider, type Dashboards, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { ToolPart } from "../tool.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { AnswerCard, type AnswerAdded } from "./answer-card.js";
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
  it("Add to the dashboard hands the host its dashboards with the tile in the relation's spec, and where it landed", async () => {
    const onAdd = vi.fn<(next: Dashboards, added: AnswerAdded) => void>();
    const saved: DashboardSpec = { filters: [{ field: "Person.age" }], tiles: [{ id: "mine", kind: "stat", measure: { op: "count" } }] };
    const other: DashboardSpec = { filters: [], tiles: [{ id: "theirs", kind: "stat", measure: { op: "count" } }] };

    // A relation nobody has edited: the automatic dashboard, as `Dashboard` draws it, then the tile.
    const { unmount } = render(<AnswerCard dashboards={{ byRelation: { Other: other } }} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />, {
      wrapper: page(),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    const [next, added] = onAdd.mock.calls[0]!;
    expect(added).toEqual({ relation: PERSON, key: "Person" });
    expect(next.byRelation.Other).toBe(other);
    expect(next.byRelation.Person!.tiles).toEqual([...autoDashboard(person.fields).tiles, output.answer.show]);
    unmount();

    // A relation with a spec: the tile after the reader's own.
    render(<AnswerCard dashboards={{ byRelation: { Person: saved } }} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    expect(onAdd.mock.calls[1]![0].byRelation.Person).toEqual({ filters: saved.filters, tiles: [saved.tiles[0], output.answer.show] });
  });

  it("is on the dashboard while the host's spec holds the tile, after a remount, and offered again once it is removed", async () => {
    const onAdd = vi.fn();
    const holding: Dashboards = { byRelation: { Person: { filters: [], tiles: [output.answer.show] } } };
    const { rerender } = render(<AnswerCard dashboards={holding} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />, { wrapper: page() });
    expect((await screen.findByRole("button", { name: "✓ On the dashboard" })).hasAttribute("disabled")).toBe(true);
    rerender(<AnswerCard dashboards={{ byRelation: { Person: { filters: [], tiles: [] } } }} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />);
    expect((await screen.findByRole("button", { name: "Add to the dashboard" })).hasAttribute("disabled")).toBe(false);
  });

  it("is pending while the host's write is, never on the dashboard before it settles, and draws a rejection as a Problem", async () => {
    let settle!: { resolve: () => void; reject: (error: unknown) => void };
    const onAdd = vi.fn<(next: Dashboards) => Promise<void>>(() => new Promise<void>((resolve, reject) => (settle = { resolve, reject })));
    const empty: Dashboards = { byRelation: {} };
    const { rerender } = render(<AnswerCard dashboards={empty} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));

    // The host draws what it is writing at once: the card waits for the write all the same.
    const writing = onAdd.mock.calls[0]![0];
    rerender(<AnswerCard dashboards={writing} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />);
    const pending = screen.getByRole("button", { name: "Adding to the dashboard…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    expect(pending.getAttribute("aria-busy")).toBe("true");

    const failure = Object.assign(new Error("The dashboard could not be saved."), { code: "api/conflict" });
    await act(async () => settle.reject(failure));
    rerender(<AnswerCard dashboards={empty} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />);
    const problem = document.querySelector("[data-slot=diagnostic]");
    expect(problem?.getAttribute("data-code")).toBe("api/conflict");
    expect(problem?.textContent).toContain("The dashboard could not be saved.");
    expect(screen.getByRole("button", { name: "Add to the dashboard" }).hasAttribute("disabled")).toBe(false);

    // Pressed again, the failure goes; confirmed, the spec the host hands back says it is there.
    await userEvent.click(screen.getByRole("button", { name: "Add to the dashboard" }));
    expect(document.querySelector("[data-slot=diagnostic]")).toBeNull();
    await act(async () => settle.resolve());
    rerender(<AnswerCard dashboards={writing} graph={PEOPLE} onAdd={onAdd} part={answered(output)} />);
    expect(screen.getByRole("button", { name: "✓ On the dashboard" })).toBeTruthy();
  });

  it("follows a host that drew the tile before its write and rolled it back when the write failed", async () => {
    const refused = new Error("The dashboard could not be saved.");
    let fail!: () => void;
    // The host: optimistic, so it draws what it is writing at once, and puts back what it held when the
    // write fails — remounting the card in between, as a host that keys its panel would.
    function Host() {
      const [dashboards, setDashboards] = useState<Dashboards>({ byRelation: {} });
      const [mount, setMount] = useState(0);
      const onAdd = (next: Dashboards) => {
        const held = dashboards;
        setDashboards(next);
        setMount((n) => n + 1);
        return new Promise<void>((_, reject) => {
          fail = () => {
            setDashboards(held);
            reject(refused);
          };
        });
      };
      return <AnswerCard dashboards={dashboards} graph={PEOPLE} key={mount} onAdd={onAdd} part={answered(output)} />;
    }
    render(<Host />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    // Remounted over a document that holds the tile, the card says what the host says.
    expect(await screen.findByRole("button", { name: "✓ On the dashboard" })).toBeTruthy();
    await act(async () => fail());
    expect((await screen.findByRole("button", { name: "Add to the dashboard" })).hasAttribute("disabled")).toBe(false);
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

  it("stays busy over the skeleton until the answer's tile is drawn", async () => {
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page() });
    const card = document.querySelector("[data-slot=answer-card]")!;
    // Answered, but its fields not read yet: the skeleton is still the tile's place.
    expect(document.querySelector("[data-slot=answer-card-pending]")).not.toBeNull();
    expect(card.getAttribute("aria-busy")).toBe("true");
    await waitFor(() => expect(document.querySelector("[data-slot=answer-card-pending]")).toBeNull());
    expect(card.hasAttribute("aria-busy")).toBe(false);
  });

  it("is not busy over a kept answer it cannot draw", () => {
    render(<AnswerCard graph={{ types: PEOPLE.types, edges: [] }} part={answered({ ...output, answer: { ...output.answer, relation: { root: "Post", path: [] } } })} />, {
      wrapper: page(),
    });
    expect(document.querySelector("[data-slot=answer-card]")?.hasAttribute("aria-busy")).toBe(false);
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
