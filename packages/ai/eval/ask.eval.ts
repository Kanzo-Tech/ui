import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  AnswerHarness,
  ComponentHarness,
  DashboardHarness,
  FilterBarHarness,
  playwright,
  type By,
  type HarnessEnvironment,
} from "@kanzo-tech/testing";
import { ASK, type AskCase, type Pair } from "./cases";
import { ANSWERED, DOUBLE } from "./double";
import { record } from "./record";

/**
 * Ask's cases, asked of the model in the page — end to end: `useAskChat` and `AnswerCard` on the
 * docs' `/fixtures/ask-eval`, the model in its worker on this machine's GPU (WebGPU), and the page's
 * engine over the case's corpus. Live, never replayed: what is measured is the model. Each case is
 * one line in `results/<label>/ask.jsonl`, scored or failed, and a case that fails is a result, not a
 * failed test — the run fails only when it cannot ask at all.
 *
 * Needs the docs running (`KANZO_DOCS_URL`, default http://localhost:3100) and the corpora written
 * (`pnpm --filter @kanzo-tech/ai eval:corpus`). `EVAL_MODEL` names another WebLLM model than the
 * page's default; `EVAL_DOUBLE=1` is the smoke run, on the double (`./double.ts`).
 */

const ORIGIN = process.env.KANZO_DOCS_URL ?? "http://localhost:3100";
const MODEL = process.env.EVAL_MODEL ?? "Qwen3-4B-q4f16_1-MLC";
const DOUBLED = process.env.EVAL_DOUBLE === "1";
const LABEL = DOUBLED ? "double" : (process.env.EVAL_LABEL ?? MODEL);

/** How long one question may take — and the model's first load, its download included — on the GPU a baseline runs on. */
const QUESTION_MS = Number(process.env.EVAL_QUESTION_MS ?? 8 * 60_000);

/**
 * Chromium with WebGPU on: headless Chromium offers it only when asked — on Linux, over Vulkan. A
 * machine with no GPU still has none, and the model's badge says so (`llm/unavailable`). The profile
 * is kept in `.cache/`, so the weights WebLLM caches are downloaded once, not once a run.
 */
const WEBGPU = ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu", ...(process.platform === "linux" ? ["--enable-features=Vulkan"] : [])];
const PROFILE = join(dirname(fileURLToPath(import.meta.url)), ".cache", "chromium");

/** The composer's placeholder, and so its name. */
const COMPOSER = "Ask about your data…";

/**
 * **The fixture's Ask panel** — `Chat` over `useAskChat`, with the model's badge. Its answer cards
 * are `AnswerHarness`'s; what this adds is a turn that ends in words — a question back, or no answer
 * — which draws no card for that harness to wait on.
 */
class AskPanel extends ComponentHarness {
  static readonly by: By = { role: "complementary", name: "Ask" };

  /**
   * Waits for the model to load — the first time on a machine, that is its download — so the clock
   * measures the model and not the load. A browser that cannot run it fails at once, with why.
   */
  async warmUp(): Promise<void> {
    const badge = await this.env.until(
      async () => (await this.host.find({ role: "button", name: /^Model (ready|failed)/ }))[0],
      "the model never loaded",
    );
    if ((await badge.text()).includes("ready")) return;
    await badge.click();
    const problem = await this.env.until(async () => (await this.env.rootElement.find({ role: "dialog" }))[0], "the model's badge opened no problem");
    throw new Error(`the model cannot run in this browser: ${(await problem.text()).trim()}`);
  }

  /** How many messages the transcript holds. */
  async messages(): Promise<number> {
    return (await this.host.find({ css: '[data-slot="message"]' })).length;
  }

  /** Sends `question` as a reader does, without waiting for what it draws. */
  async send(question: string): Promise<void> {
    const box = await this.locatorFor({ role: "textbox", name: COMPOSER })();
    await box.fill(question);
    await box.sendKeys("Enter");
  }

  /**
   * Waits for the turn `send` began to end — the question and a reply in the transcript, and the
   * composer's Stop gone — and says how: a card, words, or the panel's Problem, which rejects.
   */
  async turn(before: number): Promise<{ card: boolean; words: string; options: number }> {
    await this.env.until(async () => {
      if ((await this.host.find({ role: "alert" })).length > 0) return true;
      return (await this.messages()) >= before + 2 && (await this.host.find({ role: "button", name: "Stop" })).length === 0;
    }, "the answer never ended");
    const [alert] = await this.host.find({ role: "alert" });
    if (alert) {
      const [coded] = await alert.find({ css: "[data-code]" });
      throw new Error(`the panel failed: ${(await coded?.getAttribute("data-code")) ?? "uncoded"}: ${(await alert.text()).trim()}`);
    }
    const reply = (await this.host.find({ css: '[data-slot="message"][data-role="assistant"]' })).at(-1)!;
    const card = (await reply.find({ css: '[data-slot="answer-card"]' })).length > 0;
    const [list] = await reply.find({ role: "list" });
    const options = list ? (await list.find({ role: "listitem" })).length : 0;
    return { card, words: (await reply.text()).trim().slice(0, 1500), options };
  }
}

/** Whether `rows` — an answer's data table — holds a row reading `label` and `n` (separators aside). */
function holds(rows: readonly Record<string, string>[], [label, n]: Pair): boolean {
  return rows.some((row) => {
    const cells = Object.values(row);
    return (label === null || cells.includes(label)) && cells.some((cell) => cell.replace(/[,\s]/g, "") === String(n));
  });
}

/** The fixture's address for a case: its corpus, its relation, and the field its filter counts. */
function addressOf(c: AskCase): string {
  const query = new URLSearchParams({ corpus: c.corpus, relation: [c.page.root, ...(c.page.hops ?? [])].join(""), model: MODEL });
  if (c.page.filter) query.set("filter", c.page.filter.x);
  return `${ORIGIN}/fixtures/ask-eval?${query}`;
}

let context: BrowserContext;

beforeAll(async () => {
  mkdirSync(PROFILE, { recursive: true });
  context = await chromium.launchPersistentContext(PROFILE, { args: WEBGPU, viewport: { width: 1600, height: 1000 } });
});

afterAll(async () => {
  await context?.close();
});

const cases = DOUBLED ? ASK.filter((c) => c.ask.every((q) => ANSWERED.has(q))) : ASK;

for (const c of cases) {
  it(`ask: ${c.id}`, { timeout: c.ask.length * QUESTION_MS + 15 * 60_000 }, async () => {
    // One page a case: a conversation, and a filter, begin empty.
    const page: Page = await context.newPage();
    try {
      await asked(page, c);
    } finally {
      await page.close();
    }
  });
}

async function asked(page: Page, c: AskCase): Promise<void> {
  const env: HarnessEnvironment = await playwright(page, { timeout: QUESTION_MS, models: DOUBLED ? { [MODEL]: DOUBLE } : {} });
  await page.goto(addressOf(c));
  const dashboard = await env.getHarness(DashboardHarness);
  await dashboard.settled();
  const bar = await env.getHarness(FilterBarHarness);
  // What the page keeps, as its readout says, once the filter has taken: the proof the case asked
  // under it. A pick takes effect after it returns, so the readout is waited on.
  const kept = async () => /^[\d,]+/.exec(await bar.readout())?.[0] ?? "";
  const whole = await kept();
  const filter = c.page.filter;
  let filtered = whole;
  if (filter) {
    await (await (await dashboard.tile(`Count by ${filter.x}`)).chart()).pick({ y: filter.pick });
    filtered = await expect
      .poll(kept, { timeout: 30_000 })
      .not.toBe(whole)
      .then(kept, () => "");
    if (!filtered) {
      return record(LABEL, "ask", { case: c.id, pass: false, failure: "the page was not filtered: the case could not be set up", missing: c.holds, present: [], rows: [], turns: [], ms: 0 });
    }
  }
  const panel = await env.getHarness(AskPanel);
  // The model loaded before the clock starts: the first time on a machine, that is its download.
  const cold = await panel.warmUp().then(
    () => undefined,
    (error: Error) => error.message,
  );
  if (cold) return record(LABEL, "ask", { case: c.id, pass: false, failure: cold, missing: c.holds, present: [], rows: [], turns: [], ms: 0 });
  const answers = await env.getHarness(AnswerHarness.with({ name: COMPOSER }));

  const started = Date.now();
  const turns: number[] = [];
  let rows: Record<string, string>[] = [];
  let failure: string | undefined;
  let answered: string | undefined;
  let replied: string | undefined;
  let options = 0;
  // A case that must end in words — a question back, or no answer — is scored on the reply.
  const words = c.expects === "question" || c.expects === "refusal";
  try {
    for (const [n, question] of c.ask.entries()) {
      const asked = Date.now();
      const before = await panel.messages();
      await panel.send(question);
      const turn = await panel.turn(before);
      turns.push(Date.now() - asked);
      const last = n === c.ask.length - 1;
      if (turn.card) {
        // A refused answer rejects with its Problem's words.
        answered = await (await answers.answer()).text();
      } else if (words && last) {
        replied = turn.words;
        options = turn.options;
      } else {
        throw new Error(`it answered in words, with no card: ${turn.words.split("\n")[0]}`);
      }
    }
    if (words) {
      if (replied === undefined) throw new Error(`answered where it should have ${c.expects === "question" ? "asked which" : "said it cannot"}`);
      // A question back offers the relations as numbered options, two at least.
      if (c.expects === "question" && options < 2) throw new Error("it did not ask which, with the relations as options");
    } else {
      // The rows as the card's data table holds them. An answer that read no rows draws none, so it is
      // given 20 s, not a question's wait.
      const read = await Promise.race([answers.rows(), new Promise<undefined>((resolve) => setTimeout(resolve, 20_000, undefined))]).catch(() => undefined);
      if (read === undefined) failure = "the answer read no rows";
      else rows = read;
    }
  } catch (error) {
    failure = (error instanceof Error ? error.message.split("\n")[0] : String(error)) || undefined;
    // A run stopped from outside ends the test under every wait, and that is no result of the model's.
    if (/Target page, context or browser has been closed/.test(failure ?? "")) throw error;
  }
  const missing = c.holds.filter((pair) => !holds(rows, pair));
  const present = (c.lacks ?? []).filter((pair) => holds(rows, pair));
  record(LABEL, "ask", {
    case: c.id,
    pass: !failure && missing.length === 0 && present.length === 0,
    failure,
    answered,
    replied,
    kept: filtered,
    missing,
    present,
    rows: rows.slice(0, 10),
    turns,
    ms: Date.now() - started,
  });
}
