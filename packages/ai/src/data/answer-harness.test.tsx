import { AnswerHarness, type KanzoTestingHook } from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { Selection } from "@kanzo-tech/mosaic";
import { MosaicProvider, type Dashboards } from "@kanzo-tech/ui/analytics";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import { PromptInput, PromptInputTextarea } from "../prompt-input.js";
import type { ToolPart } from "../tool.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { AnswerCard, type AnswerCardProps } from "./answer-card.js";
import type { AnswerRelation } from "./answer.js";
import { readAnswerRelations } from "./relations.js";

/**
 * `AnswerHarness` over `AnswerCard` in jsdom: the card's states and its two actions, read the way a
 * host's end-to-end suite reads them. Asking — the composer, the model, the card that starts — is
 * held over the workspace showcase in `packages/testing/e2e`, whose Ask panel has a recorded model.
 */

let db: TestDatabase;
let output: AnswerOutput;

beforeAll(async () => {
  db = await testDatabase();
  seedPeople(db);
  const [person] = (await readAnswerRelations(db.coordinator, PEOPLE, [PERSON])) as [AnswerRelation];
  const agent = dataAgent({ model: mockModel(() => "").model, engine: db.engine, graph: PEOPLE, relations: [person] });
  const input = {
    relation: "Person",
    where: [{ field: "Person.gender", in: ["female"] }],
    show: { kind: "stat", title: "Mean age", measure: { op: "avg", field: "Person.age" } },
  };
  output = (await agent.tools.answer.execute!(input as never, { toolCallId: "c", messages: [] } as never)) as AnswerOutput;
});

afterEach(() => {
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
});

const part = (state: ToolPart["state"], extra: object = {}) => ({ type: "tool-answer", toolCallId: "c", state, input: {}, ...extra }) as ToolPart;

type Adding = Pick<AnswerCardProps, "dashboards" | "onAdd">;

/** A composer and one answer card, as `Chat` lays them out. */
function page(answer: ToolPart, adding: Adding = {}, crossfilter = Selection.crossfilter()) {
  return (
    <MosaicProvider coordinator={db.coordinator} crossfilter={crossfilter}>
      <PromptInput>
        <PromptInputTextarea placeholder="Ask about your data…" />
      </PromptInput>
      <AnswerCard graph={PEOPLE} part={answer} {...(adding as object)} />
    </MosaicProvider>
  );
}

const draw = (answer: ToolPart, adding: Adding = {}, crossfilter = Selection.crossfilter()) => render(page(answer, adding, crossfilter));

describe("AnswerHarness", () => {
  it("waits for the card to answer, reads its tile, and filters the page to it", async () => {
    const env = dom();
    const crossfilter = Selection.crossfilter();
    const { rerender } = draw(part("input-streaming"), {}, crossfilter);
    const answers = await env.harness(AnswerHarness);
    rerender(
      <MosaicProvider coordinator={db.coordinator} crossfilter={crossfilter}>
        <PromptInput>
          <PromptInputTextarea placeholder="Ask about your data…" />
        </PromptInput>
        <AnswerCard graph={PEOPLE} part={part("output-available", { output })} />
      </MosaicProvider>,
    );
    const tile = await answers.answer();
    await expect.poll(() => tile.text()).toMatch(/^Mean age.*34/);
    await answers.filterTo();
    expect(crossfilter.clauses).toHaveLength(1);
  });

  it("adds the answer to the dashboard, through the host's pending write, and waits for the card to say it is there", async () => {
    const env = dom();
    let settle = () => {};
    const onAdd = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    // The host: draws the document it is handed at once, and confirms the write when the test says so.
    function Host() {
      const [dashboards, setDashboards] = useState<Dashboards>({ byRelation: {} });
      const [crossfilter] = useState(() => Selection.crossfilter());
      const adding: Adding = {
        dashboards,
        onAdd: (next) => {
          setDashboards(next);
          return onAdd();
        },
      };
      return page(part("output-available", { output }), adding, crossfilter);
    }
    render(<Host />);
    const added = (await env.harness(AnswerHarness)).addToDashboard();
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled(), { timeout: 10_000 });
    await screen.findByRole("button", { name: "Adding to the dashboard…" });
    settle();
    await added;
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("rejects an add the host refused with the words of the card's Problem", async () => {
    const env = dom();
    const onAdd = () => Promise.reject(new Error("The dashboard could not be saved."));
    draw(part("output-available", { output }), { dashboards: { byRelation: {} }, onAdd });
    await expect((await env.harness(AnswerHarness)).addToDashboard()).rejects.toThrow(/not added to the dashboard.*could not be saved/);
  });

  it("rejects an answer that failed with the words of its Problem", async () => {
    const env = dom();
    draw(part("output-error", { errorText: "show.x: secret is not a field of Person." }));
    await expect((await env.harness(AnswerHarness)).answer()).rejects.toThrow(/The answer failed.*secret is not a field of Person/);
  });
});
