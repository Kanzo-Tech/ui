// No `"use client"` here, and `client-boundary.test.ts` is what caught the first version that had
// one: this module holds no state, no effect and no handler of its own. `streamdown/dist/index.js`
// opens with the directive itself, so importing it establishes the boundary — a second one here
// would opt the wrapper out of server rendering for nothing.
import { Streamdown, type StreamdownProps } from "streamdown";
import { cn } from "@kanzo-tech/ui";

/**
 * **`MessageText`, for a source that streams markdown.**
 *
 * `MessageText` takes a plain string and renders it as text, which is right for a model answering
 * in prose and wrong the moment one emits a `**bold`, a list or a fence. The hard part is not the
 * markdown — it is the *incomplete* markdown: a stream delivers `**bo`, then `**bold`, then
 * `**bold**`, and a parser that renders each of those honestly makes the answer flicker between
 * literal asterisks and emphasis as it completes. Streamdown exists to close those, and closing
 * them well is a parser's worth of work rather than a component's.
 *
 * ## Why a subpath, and it is a one-way door
 *
 * **Measured before it was decided:** `streamdown` bundles to **495 kB minified, 128 kB brotli**
 * on its own — `parse5` 123 kB for `rehype-raw`'s HTML, `entities` 51 kB, `marked` 40 kB, the
 * unified stack behind them. `@kanzo-tech/ai`'s whole root barrel is budgeted at 20 kB and measures
 * 8.34. A static import from `index.ts` would take every host that renders plain prose from 8 kB to
 * roughly 136, for a parser it never calls.
 *
 * So it lives here, behind `@kanzo-tech/ai/markdown`, with `streamdown` as an **optional peer** —
 * the same door `@kanzo-tech/ui/editor` stands behind for CodeMirror and `@kanzo-tech/graph/duckdb`
 * for Mosaic, and `scripts/smoke-install.mjs` is what holds it shut: it packs the real tarball,
 * installs it *without* the optional peers, and imports the root barrel.
 *
 * ## The animation is Streamdown's now, not ours
 *
 * `MessageText` hand-rolls a per-word cascade whose four rules are all read off Streamdown's
 * `animate.ts` — its docblock says so and names each one. Here the original is present, so it does
 * the work: `animated` with `sep: "word"` is the same idea from the source it was copied from, and
 * two implementations of one cascade is one too many. The numbers below are `MessageText`'s, so a
 * transcript that mixes the two components does not visibly change rhythm mid-conversation.
 *
 * **A message that mounts complete did not arrive**, so `streaming` also decides whether anything
 * animates at all — a transcript loaded from history must not replay itself, which is the one rule
 * of `MessageText` that has no counterpart in a prop and has to be spelled here.
 */
export interface MessageMarkdownProps
  extends Omit<StreamdownProps, "children" | "mode" | "animated"> {
  /** The answer so far, as markdown. Grows; never rewritten. */
  children: string;
  /** More is coming: closes the incomplete markdown, animates the arrival, draws the caret. */
  streaming?: boolean;
}

/** `MessageText`'s cascade, so the two components keep the same rhythm. See its docblock. */
const STAGGER = 18;

export const MessageMarkdown = (props: MessageMarkdownProps) => {
  const { children, streaming = false, className, ...rest } = props;

  return (
    <Streamdown
      animated={streaming ? { sep: "word", stagger: STAGGER } : false}
      className={cn("min-w-0 break-words", className)}
      // Streamdown's own caret, rather than the `<span>` `MessageText` draws: it belongs at the end
      // of the last *rendered* block, which only the renderer knows — a caret appended by us would
      // sit after a table rather than inside the paragraph the model is still writing.
      caret={streaming ? "block" : undefined}
      data-streaming={streaming || undefined}
      mode={streaming ? "streaming" : "static"}
      // The whole point. `false` renders `**bo` as two asterisks and a `bo`.
      parseIncompleteMarkdown={streaming}
      {...rest}
    >
      {children}
    </Streamdown>
  );
};
