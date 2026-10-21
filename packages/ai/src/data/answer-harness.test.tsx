import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnswerHarness } from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { patternKey, type Selection } from "@kanzo-tech/mosaic";
import { MosaicProvider, useMosaic, type Dashboards } from "@kanzo-tech/ui/analytics";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { testDatabase, type TestDatabase } from "../testing/duckdb.js";
import { PERSON, SNB } from "../testing/snb.js";
import { PromptInput, PromptInputTextarea } from "../prompt-input.js";
import type { AnswerOutput } from "./read.js";
import { readFor } from "../testing/answer.js";
import { AnswerCard, type AnswerCardProps } from "./answer-card.js";

/** The host's one client: every read the parts make is a query on it. */
const queries = new QueryClient();

/**
 * `AnswerHarness` over `AnswerCard` in jsdom: the card's states and its two actions, read the way a
 * host's end-to-end suite reads them. Asking — the composer, the model, the card that starts — is
 * held over the workspace showcase in `packages/testing/e2e`, whose Ask panel has a recorded model.
 */

let db: TestDatabase;
let output: AnswerOutput;

beforeAll(async () => {
  db = await testDatabase();
  output = await readFor(db.engine, SNB, {
    match: PERSON,
    where: [{ field: "person.gender", in: ["female"] }],
    show: { kind: "stat", title: "Women", measure: { op: "count" } },
  });
});

type Adding = Pick<AnswerCardProps, "dashboards" | "onAdd" | "onOpen">;

/** A composer and one answer card, as `Chat` lays them out. */
/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}

function page(answer: AnswerOutput, adding: Adding = {}, into: (selection: Selection) => void = () => {}) {
  return (
    <QueryClientProvider client={queries}><MosaicProvider engine={db.engine} graph={SNB}>
      <Page into={into} />
      <PromptInput>
        <PromptInputTextarea placeholder="Ask about your data…" />
      </PromptInput>
      <AnswerCard answer={answer} graph={SNB} {...(adding as object)} />
    </MosaicProvider></QueryClientProvider>
  );
}

const draw = (answer: AnswerOutput, adding: Adding = {}, into: (selection: Selection) => void = () => {}) => render(page(answer, adding, into));

describe("AnswerHarness", () => {
  it("waits for the card to answer, reads its tile, and filters the page to it", async () => {
    const env = dom();
    let crossfilter!: Selection;
    const { rerender } = draw({ answer: output.answer }, {}, (s) => (crossfilter = s));
    const answers = await env.getHarness(AnswerHarness);
    rerender(
      <QueryClientProvider client={queries}><MosaicProvider engine={db.engine} graph={SNB}>
        <Page into={(s) => (crossfilter = s)} />
        <PromptInput>
          <PromptInputTextarea placeholder="Ask about your data…" />
        </PromptInput>
        <AnswerCard answer={output} graph={SNB} />
      </MosaicProvider></QueryClientProvider>,
    );
    const tile = await answers.answer();
    await expect.poll(() => tile.text()).toMatch(/^Women.*5/);
    await answers.filterTo();
    expect(crossfilter.clauses).toHaveLength(1);
  });

  it("reads the rows the answer was read from — the engine's result, not the tile's drawing", async () => {
    const env = dom();
    draw(output);
    const rows = await (await env.getHarness(AnswerHarness)).rows();
    // What the engine returned, cell for cell: the five women of the twelve.
    expect(rows).toEqual(output.rows!.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)]))));
    expect(rows).toHaveLength(1);
    expect(Object.values(rows[0]!)).toContain("5");
  });

  it("adds the answer to the dashboard, through the host's pending write, and waits for the card to say it is there", async () => {
    const env = dom();
    let settle = () => {};
    const onAdd = vi.fn(() => new Promise<void>((resolve) => (settle = resolve)));
    // The host: draws the document it is handed at once, and confirms the write when the test says so.
    function Host() {
      const [dashboards, setDashboards] = useState<Dashboards>({ byPattern: {} });
      const adding: Adding = {
        dashboards,
        onAdd: (next) => {
          setDashboards(next);
          return onAdd();
        },
      };
      return page(output, adding);
    }
    render(<Host />);
    const added = (await env.getHarness(AnswerHarness)).addToDashboard();
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled(), { timeout: 10_000 });
    await screen.findByRole("button", { name: "Adding to the dashboard…" });
    settle();
    await added;
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("opens the answer on the dashboard once it is there, through the host's onOpen", async () => {
    const env = dom();
    const onOpen = vi.fn();
    const holding: Dashboards = { byPattern: { [patternKey(PERSON)]: { filters: [], tiles: [output.answer.tile] } } };
    draw(output, { dashboards: holding, onAdd: vi.fn(), onOpen });
    await (await env.getHarness(AnswerHarness)).openOnDashboard();
    expect(onOpen).toHaveBeenCalledWith({ pattern: PERSON, key: patternKey(PERSON), id: output.answer.tile.id });
  });

  it("rejects an add the host refused with the words of the card's Problem", async () => {
    const env = dom();
    const onAdd = () => Promise.reject(new Error("The dashboard could not be saved."));
    draw(output, { dashboards: { byPattern: {} }, onAdd });
    await expect((await env.getHarness(AnswerHarness)).addToDashboard()).rejects.toThrow(/not added to the dashboard.*could not be saved/);
  });

  it("rejects an answer that failed with the words of its Problem", async () => {
    const env = dom();
    // A kept answer over a pattern the host's graph no longer has.
    draw({ ...output, answer: { ...output.answer, pattern: [{ as: "movie", type: "Movie" }] } });
    await expect((await env.getHarness(AnswerHarness)).answer()).rejects.toThrow(/The answer failed.*Movie/);
  });
});
