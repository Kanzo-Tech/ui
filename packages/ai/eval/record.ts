import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where a run's results go: `results/<label>/<suite>.jsonl`, one line per case, appended — gitignored,
 * because a result is a run's, not the repository's. The label is the model's id, or `EVAL_LABEL`
 * when a run wants another (a GPU, a setting), or `double` for the smoke run.
 */
export function record(label: string, suite: string, result: Record<string, unknown>): void {
  const results = join(dirname(fileURLToPath(import.meta.url)), "results", label);
  mkdirSync(results, { recursive: true });
  appendFileSync(join(results, `${suite}.jsonl`), `${JSON.stringify({ model: label, at: new Date().toISOString(), ...result })}\n`);
}
