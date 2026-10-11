import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clauseLabel, type Selection } from "@kanzo-tech/mosaic";
import { autoDashboard, MosaicProvider, useMosaic, type Dashboards, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { KNOWS, PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { ToolPart } from "../tool.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { AnswerCard, type AnswerAdded } from "./answer-card.js";
import type { AnswerRelation } from "./answer.js";
import { readAnswerRelations } from "./relations.js";

let db: TestDatabase;
let person: AnswerRelation;
let output: AnswerOutput;
let everyone: AnswerOutput;
let first: AnswerOutput;
let knowing: AnswerOutput;

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  const [personal, knows] = (await readAnswerRelations(db.coordinator, PEOPLE, [PERSON, KNOWS])) as [AnswerRelation, AnswerRelation];
  person = personal;
  const agent = dataAgent({ model: mockModel(() => "").model, engine: db.engine, graph: PEOPLE, relations: [person, knows] });
  const input = {
    relation: "Person",
    where: [{ field: "Person.gender", in: ["female"] }],
    show: { kind: "stat", measure: { op: "avg", field: "Person.age" } },
  };
  output = await ask(input);
  // keasy's snb-ask: a bar of every category, and nothing to narrow it — every person is in one.
  everyone = await ask({ relation: "Person", show: { kind: "chart", type: "bar", x: "Person.gender", y: { op: "count" } } });
  // The same bars, ranked down to the first: one gender of two.
  first = await ask({ relation: "Person", top: 1, show: { kind: "chart", type: "bar", x: "Person.gender", y: { op: "count" } } });
  // Through a hop, every category still keeps only the people who know someone.
  knowing = await ask({ relation: "Person>knows>Person", show: { kind: "chart", type: "bar", x: "Person.gender", y: { op: "count" } } });

  async function ask(input: object) {
    return (await agent.tools.answer.execute!(input as never, { toolCallId: "c", messages: [] } as never)) as AnswerOutput;
  }
});

const answered = (kept: AnswerOutput) =>
  ({ type: "tool-answer", toolCallId: "c", state: "output-available", input: {}, output: kept }) as ToolPart;
const at = (state: ToolPart["state"], extra: object = {}) => ({ type: "tool-answer", toolCallId: "c", state, input: {}, ...extra }) as ToolPart;

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}

/** An element's description, as `aria-describedby` names it — what assistive technology reads after its name. */
const description = (element: Element) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

function page(into: (selection: Selection) => void = () => {}) {
  return ({ children }: { children: React.ReactNode }) => (
    <MosaicProvider coordinator={db.coordinator}>
      <Page into={into} />
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
    expect(added).toEqual({ relation: PERSON, key: "Person", id: output.answer.show.id });
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
    expect((await screen.findByRole("button", { name: "On the dashboard" })).hasAttribute("disabled")).toBe(true);
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
    expect(screen.getByRole("button", { name: "On the dashboard" })).toBeTruthy();
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
    expect(await screen.findByRole("button", { name: "On the dashboard" })).toBeTruthy();
    await act(async () => fail());
    expect((await screen.findByRole("button", { name: "Add to the dashboard" })).hasAttribute("disabled")).toBe(false);
  });

  it("filters the page to the answer as one semi-join on the root key, and takes it back", async () => {
    let crossfilter!: Selection;
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page((s) => (crossfilter = s)) });
    const button = await screen.findByRole("button", { name: "Filter the page to these rows" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(button);
    expect(crossfilter.clauses).toHaveLength(1);
    expect(String(crossfilter.predicate(null))).toContain(`"dense_id" IN (SELECT "dense_id" FROM`);
    expect(String(crossfilter.predicate(null))).toContain(`"Person.gender" IN ('female')`);
    // The same button, its name kept, pressed while the clause holds.
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(button);
    expect(crossfilter.clauses.filter((c) => c.predicate != null)).toHaveLength(0);
  });

  it("names the chip after what it filters, as the filter bar reads each clause", async () => {
    let crossfilter!: Selection;
    const { unmount } = render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page((s) => (crossfilter = s)) });
    await userEvent.click(await screen.findByRole("button", { name: "Filter the page to these rows" }));
    expect(clauseLabel(crossfilter.clauses[0]!)).toBe("Ask: Person.gender female");
    unmount();

    let ranked!: Selection;
    render(<AnswerCard graph={PEOPLE} part={answered(first)} />, { wrapper: page((s) => (ranked = s)) });
    await userEvent.click(await screen.findByRole("button", { name: "Filter the page to these rows" }));
    expect(clauseLabel(ranked.clauses[0]!)).toBe(`Ask: Person.gender ${String(first.rows[0]!["Person.gender"])}`);
  });

  it("is disabled, and says why, when its clause would keep everything in view", async () => {
    render(<AnswerCard graph={PEOPLE} part={answered(everyone)} />, { wrapper: page() });
    const idle = await screen.findByRole("button", { name: "Filter the page to these rows" });
    expect(idle.hasAttribute("disabled")).toBe(true);
    expect(description(idle)).toBe("This answer keeps everything in view");
  });

  it("filters when the bars are ranked down to some categories, or cross a hop", async () => {
    for (const kept of [first, knowing]) {
      const { unmount } = render(<AnswerCard graph={PEOPLE} part={answered(kept)} />, { wrapper: page() });
      const button = await screen.findByRole("button", { name: "Filter the page to these rows" });
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(description(button)).toBe("");
      unmount();
    }
  });

  it("draws its verbs in the tile's header, beside its title", async () => {
    const dashboards: Dashboards = { byRelation: {} };
    const { unmount } = render(<AnswerCard dashboards={dashboards} graph={PEOPLE} onAdd={vi.fn()} part={answered(everyone)} />, { wrapper: page() });
    for (const name of ["Filter the page to these rows", "Add to the dashboard"]) {
      expect((await screen.findByRole("button", { name })).closest("[data-slot=card-header]")).not.toBeNull();
    }
    unmount();
    render(<AnswerCard dashboards={dashboards} graph={PEOPLE} onAdd={vi.fn()} part={answered(output)} />, { wrapper: page() });
    const add = await screen.findByRole("button", { name: "Add to the dashboard" });
    expect(add.closest("[data-slot=stat-root]")).not.toBeNull();
  });

  it("opens the tile on the dashboard once it is there, when the host says how", async () => {
    const onOpen = vi.fn<(added: AnswerAdded) => void>();
    const holding: Dashboards = { byRelation: { Person: { filters: [], tiles: [output.answer.show] } } };
    render(<AnswerCard dashboards={holding} graph={PEOPLE} onAdd={vi.fn()} onOpen={onOpen} part={answered(output)} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Open on the dashboard" }));
    expect(onOpen).toHaveBeenCalledWith({ relation: PERSON, key: "Person", id: output.answer.show.id });
    expect(screen.queryByRole("button", { name: "On the dashboard" })).toBeNull();
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

  it("says which of the page's clauses the answer was read under, and which its relation could not answer", async () => {
    const kept = { ...output, under: ["Person.gender female"], unanswered: [{ clause: "City.name Madrid", missing: ["City.name"] }] };
    render(<AnswerCard graph={PEOPLE} part={answered(kept)} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=answer-card-filter]")).not.toBeNull());
    expect(document.querySelector("[data-slot=answer-card-filter]")!.textContent).toBe(
      "Read under the page's filter: Person.gender female. Keeps none of this relation's rows, which lack the fields they filter: City.name Madrid (City.name).",
    );
  });

  it("says nothing of the page's filter when the page had none", async () => {
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=stat-value]")).not.toBeNull());
    expect(document.querySelector("[data-slot=answer-card-filter]")).toBeNull();
  });

  it("draws the figure the answer is, read under its conditions", async () => {
    render(<AnswerCard graph={PEOPLE} part={answered(output)} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=stat-value]")?.textContent).toBe("34"));
  });
});
