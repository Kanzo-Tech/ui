import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clauseLabel, type Selection } from "@kanzo-tech/mosaic";
import { autoDashboard, MosaicProvider, useMosaic, type Dashboards, type DashboardSpec } from "@kanzo-tech/ui/analytics";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { AnswerOutput } from "./read.js";
import { readFor } from "../testing/answer.js";
import { AnswerCard, type AnswerAdded } from "./answer-card.js";
import type { AnswerRelation } from "./answer.js";
import { answerRelation, type AskSpec } from "./ask.js";

/** The host's one client: every read the parts make is a query on it. */
const queries = new QueryClient();

let db: TestDatabase;
let person: AnswerRelation;
let output: AnswerOutput;
let everyone: AnswerOutput;
let first: AnswerOutput;
let knowing: AnswerOutput;

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  [person] = [answerRelation(PERSON, PEOPLE)];
  output = await ask({ of: "Person", where: [{ field: "gender", in: ["female"] }], show: { kind: "stat", measure: { op: "avg", field: "age" } } });
  // keasy's snb-ask: a bar of every category, and nothing to narrow it — every person is in one.
  everyone = await ask({ of: "Person", show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } } });
  // The same bars, ranked down to the first: one gender of two.
  first = await ask({ of: "Person", top: 1, show: { kind: "chart", type: "bar", x: "gender", y: { op: "count" } } });
  // Through a hop — counting whom they know — every category still keeps only the people who know someone.
  knowing = await ask({ of: "Person", show: { kind: "chart", type: "bar", x: "gender", y: { op: "count", path: "knows" } } });

  async function ask(spec: AskSpec) {
    return readFor(db.engine, PEOPLE, spec);
  }
});


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
    <QueryClientProvider client={queries}><MosaicProvider engine={db.engine}>
      <Page into={into} />
      {children}
    </MosaicProvider></QueryClientProvider>
  );
}

describe("AnswerCard", () => {
  it("Add to the dashboard hands the host its dashboards with the tile in the relation's spec, and where it landed", async () => {
    const onAdd = vi.fn<(next: Dashboards, added: AnswerAdded) => void>();
    const saved: DashboardSpec = { filters: [{ field: "age" }], tiles: [{ id: "mine", kind: "stat", measure: { op: "count" } }] };
    const other: DashboardSpec = { filters: [], tiles: [{ id: "theirs", kind: "stat", measure: { op: "count" } }] };

    // A relation nobody has edited: the automatic dashboard, as `Dashboard` draws it, then the tile.
    const { unmount } = render(<AnswerCard dashboards={{ byRelation: { Other: other } }} graph={PEOPLE} onAdd={onAdd} answer={output} />, {
      wrapper: page(),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    const [next, added] = onAdd.mock.calls[0]!;
    expect(added).toEqual({ relation: PERSON, key: "Person", id: output.answer.tile.id });
    expect(next.byRelation.Other).toBe(other);
    expect(next.byRelation.Person!.tiles).toEqual([...autoDashboard(person.fields).tiles, output.answer.tile]);
    unmount();

    // A relation with a spec: the tile after the reader's own.
    render(<AnswerCard dashboards={{ byRelation: { Person: saved } }} graph={PEOPLE} onAdd={onAdd} answer={output} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));
    expect(onAdd.mock.calls[1]![0].byRelation.Person).toEqual({ filters: saved.filters, tiles: [saved.tiles[0], output.answer.tile] });
  });

  it("is on the dashboard while the host's spec holds the tile, after a remount, and offered again once it is removed", async () => {
    const onAdd = vi.fn();
    const holding: Dashboards = { byRelation: { Person: { filters: [], tiles: [output.answer.tile] } } };
    const { rerender } = render(<AnswerCard dashboards={holding} graph={PEOPLE} onAdd={onAdd} answer={output} />, { wrapper: page() });
    expect((await screen.findByRole("button", { name: "On the dashboard" })).hasAttribute("disabled")).toBe(true);
    rerender(<AnswerCard dashboards={{ byRelation: { Person: { filters: [], tiles: [] } } }} graph={PEOPLE} onAdd={onAdd} answer={output} />);
    expect((await screen.findByRole("button", { name: "Add to the dashboard" })).hasAttribute("disabled")).toBe(false);
  });

  it("is pending while the host's write is, never on the dashboard before it settles, and draws a rejection as a Problem", async () => {
    let settle!: { resolve: () => void; reject: (error: unknown) => void };
    const onAdd = vi.fn<(next: Dashboards) => Promise<void>>(() => new Promise<void>((resolve, reject) => (settle = { resolve, reject })));
    const empty: Dashboards = { byRelation: {} };
    const { rerender } = render(<AnswerCard dashboards={empty} graph={PEOPLE} onAdd={onAdd} answer={output} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Add to the dashboard" }));

    // The host draws what it is writing at once: the card waits for the write all the same.
    const writing = onAdd.mock.calls[0]![0];
    rerender(<AnswerCard dashboards={writing} graph={PEOPLE} onAdd={onAdd} answer={output} />);
    const pending = screen.getByRole("button", { name: "Adding to the dashboard…" });
    expect(pending.hasAttribute("disabled")).toBe(true);
    expect(pending.getAttribute("aria-busy")).toBe("true");

    const failure = Object.assign(new Error("The dashboard could not be saved."), { code: "api/conflict" });
    await act(async () => settle.reject(failure));
    rerender(<AnswerCard dashboards={empty} graph={PEOPLE} onAdd={onAdd} answer={output} />);
    const problem = document.querySelector("[data-slot=diagnostic]");
    expect(problem?.getAttribute("data-code")).toBe("api/conflict");
    expect(problem?.textContent).toContain("The dashboard could not be saved.");
    expect(screen.getByRole("button", { name: "Add to the dashboard" }).hasAttribute("disabled")).toBe(false);

    // Pressed again, the failure goes; confirmed, the spec the host hands back says it is there.
    await userEvent.click(screen.getByRole("button", { name: "Add to the dashboard" }));
    expect(document.querySelector("[data-slot=diagnostic]")).toBeNull();
    await act(async () => settle.resolve());
    rerender(<AnswerCard dashboards={writing} graph={PEOPLE} onAdd={onAdd} answer={output} />);
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
      return <AnswerCard dashboards={dashboards} graph={PEOPLE} key={mount} onAdd={onAdd} answer={output} />;
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
    render(<AnswerCard graph={PEOPLE} answer={output} />, { wrapper: page((s) => (crossfilter = s)) });
    const button = await screen.findByRole("button", { name: "Filter the page to these rows" });
    expect(button.getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(button);
    expect(crossfilter.clauses).toHaveLength(1);
    expect(String(crossfilter.predicate(null))).toContain(`"dense_id" IN (SELECT "dense_id" FROM`);
    expect(String(crossfilter.predicate(null))).toContain(`"gender" IN ('female')`);
    // The same button, its name kept, pressed while the clause holds.
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(button);
    expect(crossfilter.clauses.filter((c) => c.predicate != null)).toHaveLength(0);
  });

  it("names the chip after what it filters, as the filter bar reads each clause", async () => {
    let crossfilter!: Selection;
    const { unmount } = render(<AnswerCard graph={PEOPLE} answer={output} />, { wrapper: page((s) => (crossfilter = s)) });
    await userEvent.click(await screen.findByRole("button", { name: "Filter the page to these rows" }));
    expect(clauseLabel(crossfilter.clauses[0]!)).toBe("Ask: gender female");
    unmount();

    let ranked!: Selection;
    render(<AnswerCard graph={PEOPLE} answer={first} />, { wrapper: page((s) => (ranked = s)) });
    await userEvent.click(await screen.findByRole("button", { name: "Filter the page to these rows" }));
    expect(clauseLabel(ranked.clauses[0]!)).toBe(`Ask: gender ${String(first.rows![0]!["gender"])}`);
  });

  it("is disabled, and says why, when its clause would keep everything in view", async () => {
    render(<AnswerCard graph={PEOPLE} answer={everyone} />, { wrapper: page() });
    const idle = await screen.findByRole("button", { name: "Filter the page to these rows" });
    expect(idle.hasAttribute("disabled")).toBe(true);
    expect(description(idle)).toBe("This answer keeps everything in view");
  });

  it("filters when the bars are ranked down to some categories, or cross a hop", async () => {
    for (const kept of [first, knowing]) {
      const { unmount } = render(<AnswerCard graph={PEOPLE} answer={kept} />, { wrapper: page() });
      const button = await screen.findByRole("button", { name: "Filter the page to these rows" });
      expect(button.hasAttribute("disabled")).toBe(false);
      expect(description(button)).toBe("");
      unmount();
    }
  });

  it("draws its verbs in the tile's header, beside its title", async () => {
    const dashboards: Dashboards = { byRelation: {} };
    const { unmount } = render(<AnswerCard dashboards={dashboards} graph={PEOPLE} onAdd={vi.fn()} answer={everyone} />, { wrapper: page() });
    for (const name of ["Filter the page to these rows", "Add to the dashboard"]) {
      expect((await screen.findByRole("button", { name })).closest("[data-slot=card-header]")).not.toBeNull();
    }
    unmount();
    render(<AnswerCard dashboards={dashboards} graph={PEOPLE} onAdd={vi.fn()} answer={output} />, { wrapper: page() });
    const add = await screen.findByRole("button", { name: "Add to the dashboard" });
    expect(add.closest("[data-slot=stat-root]")).not.toBeNull();
  });

  it("opens the tile on the dashboard once it is there, when the host says how", async () => {
    const onOpen = vi.fn<(added: AnswerAdded) => void>();
    const holding: Dashboards = { byRelation: { Person: { filters: [], tiles: [output.answer.tile] } } };
    render(<AnswerCard dashboards={holding} graph={PEOPLE} onAdd={vi.fn()} onOpen={onOpen} answer={output} />, { wrapper: page() });
    await userEvent.click(await screen.findByRole("button", { name: "Open on the dashboard" }));
    expect(onOpen).toHaveBeenCalledWith({ relation: PERSON, key: "Person", id: output.answer.tile.id });
    expect(screen.queryByRole("button", { name: "On the dashboard" })).toBeNull();
  });

  it("draws an answered tile at once, never busy: its fields are the graph's, and nothing is read for them", () => {
    queries.clear();
    render(<AnswerCard graph={PEOPLE} answer={output} />, { wrapper: page() });
    expect(document.querySelector("[data-slot=answer-card-pending]")).toBeNull();
    expect(document.querySelector("[data-slot=answer-card]")!.hasAttribute("aria-busy")).toBe(false);
  });

  it("is not busy over a kept answer it cannot draw", () => {
    render(<AnswerCard graph={{ types: PEOPLE.types, edges: [] }} answer={{ ...output, answer: { ...output.answer, relation: { root: "Post", path: [] } } }} />, {
      wrapper: page(),
    });
    expect(document.querySelector("[data-slot=answer-card]")?.hasAttribute("aria-busy")).toBe(false);
  });

  it("is busy until read, over a skeleton the chart's height, and not once stopped", () => {
    const asked = { answer: output.answer };
    const { rerender } = render(<AnswerCard answer={asked} graph={PEOPLE} />, { wrapper: page() });
    expect(document.querySelector("[data-slot=answer-card]")?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("[data-slot=answer-card-pending]")?.className).toContain("h-[220px]");
    rerender(<AnswerCard answer={asked} graph={PEOPLE} stopped />);
    expect(document.querySelector("[data-slot=answer-card]")?.hasAttribute("aria-busy")).toBe(false);
    expect(document.querySelector("[data-slot=answer-card-pending]")).toBeNull();
  });

  it("draws a kept answer whose relation the graph no longer has as a Problem", () => {
    render(<AnswerCard graph={{ types: PEOPLE.types, edges: [] }} answer={{ ...output, answer: { ...output.answer, relation: { root: "Post", path: [] } } }} />, {
      wrapper: page(),
    });
    expect(document.querySelector("[data-slot=diagnostic]")?.textContent).toContain("the join graph has no type Post");
  });

  it("says which of the page's clauses the answer was read under, and which its relation could not answer", async () => {
    const kept = { ...output, under: ["gender female"], unanswered: [{ clause: "City.name Madrid", missing: ["City.name"] }] };
    render(<AnswerCard graph={PEOPLE} answer={kept} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=answer-card-filter]")).not.toBeNull());
    expect(document.querySelector("[data-slot=answer-card-filter]")!.textContent).toBe(
      "Read under the page's filter: gender female. Keeps none of this relation's rows, which lack the fields they filter: City.name Madrid (City.name).",
    );
  });

  it("says nothing of the page's filter when the page had none", async () => {
    render(<AnswerCard graph={PEOPLE} answer={output} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=stat-value]")).not.toBeNull());
    expect(document.querySelector("[data-slot=answer-card-filter]")).toBeNull();
  });

  it("draws the figure the answer is, read under its conditions", async () => {
    render(<AnswerCard graph={PEOPLE} answer={output} />, { wrapper: page() });
    await waitFor(() => expect(document.querySelector("[data-slot=stat-value]")?.textContent).toBe("34"));
  });
});
