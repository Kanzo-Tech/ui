import { AskEval } from "./ask-eval";

/**
 * The page Ask's evaluation set asks its questions on, not a page anybody reads.
 *
 * `packages/ai/eval/ask.eval.ts` drives it: a corpus attached by name, a dashboard over one relation
 * of it, and Ask beside it on the page's one selection, with the model in the page. What is measured
 * is the model; everything around it is the path a host writes (`/docs/design/testing`, *Ask's
 * evaluation set lives beside Ask*).
 */
export default function Page() {
  return <AskEval />;
}

export const metadata = { title: "Ask evaluation fixture", robots: { index: false } };
