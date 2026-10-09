import { AnswerHarness, type KanzoTestingHook } from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { Selection } from "@kanzo-tech/mosaic";
import { MosaicProvider } from "@kanzo-tech/ui/analytics";
import { render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mockModel } from "../testing/model.js";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PEOPLE, PERSON, seedPeople } from "../testing/people.js";
import type { ToolPart } from "../tool.js";
import { dataAgent, type AnswerOutput } from "./agent.js";
import { AnswerCard } from "./answer-card.js";
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
  const agent = dataAgent({ model: mockModel(() => "").model, coordinator: db.coordinator, graph: PEOPLE, relations: [person] });
  const input = {
    relation: PERSON,
    where: [{ field: "Person.gender", in: ["female"] }],
    show: { kind: "stat", title: "Mean age", measure: { op: "avg", field: "Person.age" } },
  };
  output = (await agent.tools.answer.execute!(input as never, { toolCallId: "c", messages: [] } as never)) as AnswerOutput;
});

afterEach(() => {
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
});

const part = (state: ToolPart["state"], extra: object = {}) => ({ type: "tool-answer", toolCallId: "c", state, input: {}, ...extra }) as ToolPart;

/**
 * A composer and one answer card, as `Chat` lays them out. Named by `aria-label`: `Chat`'s composer is
 * named by its placeholder alone, which a browser reads and jsdom's name computation does not.
 */
function draw(answer: ToolPart, props: Partial<React.ComponentProps<typeof AnswerCard>> = {}, crossfilter = Selection.crossfilter()) {
  return render(
    <MosaicProvider coordinator={db.coordinator} crossfilter={crossfilter}>
      <textarea aria-label="Ask about your data" />
      <AnswerCard graph={PEOPLE} part={answer} {...props} />
    </MosaicProvider>,
  );
}

describe("AnswerHarness", () => {
  it("waits for the card to answer, reads its tile, and filters the page to it", async () => {
    const env = dom();
    const crossfilter = Selection.crossfilter();
    const { rerender } = draw(part("input-streaming"), {}, crossfilter);
    const answers = await env.harness(AnswerHarness);
    rerender(
      <MosaicProvider coordinator={db.coordinator} crossfilter={crossfilter}>
        <textarea aria-label="Ask about your data" />
        <AnswerCard graph={PEOPLE} part={part("output-available", { output })} />
      </MosaicProvider>,
    );
    const tile = await answers.answer();
    await expect.poll(() => tile.text()).toMatch(/^Mean age.*34/);
    await answers.filterTo();
    expect(crossfilter.clauses).toHaveLength(1);
  });

  it("adds the answer to the dashboard, and waits for the card to say it is there", async () => {
    const env = dom();
    const onAdd = vi.fn();
    draw(part("output-available", { output }), { onAdd });
    await (await env.harness(AnswerHarness)).addToDashboard();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("rejects an answer that failed with the words of its Problem", async () => {
    const env = dom();
    draw(part("output-error", { errorText: "show.x: secret is not a field of Person." }));
    await expect((await env.harness(AnswerHarness)).answer()).rejects.toThrow(/The answer failed.*secret is not a field of Person/);
  });
});
