// No `"use client"` here, and `client-boundary.test.ts` is what caught the first version that had
// one: this module holds no state, no effect and no handler of its own. `streamdown/dist/index.js`
// opens with the directive itself, so importing it establishes the boundary — a second one here
// would opt the wrapper out of server rendering for nothing.
import { Streamdown, defaultRehypePlugins, type StreamdownProps } from "streamdown";
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
 * ## Safe by default
 *
 * A model's markdown is untrusted text. An image in it is a request the reader's browser makes to
 * whoever the model named — a tracking pixel, or the channel a prompt injection reads a secret out
 * through — so **no image loads**, remote or `data:`; a `javascript:` link is dropped and any other
 * asks the reader before it opens (Streamdown's link check). A host that renders its own
 * authored markdown reopens this with Streamdown's own props: `rehypePlugins` and `linkSafety`.
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
  /**
   * Renames the part. Declared here and nowhere else in the package: every other component takes
   * `slot` for free from `React.HTMLAttributes`, and `StreamdownProps` is react-markdown's
   * `Options` rather than the attributes of an element, so it carries no `slot` to inherit.
   */
  slot?: string;
}

/**
 * Streamdown's own pipeline — raw HTML, sanitised, then hardened — with the hardening shut: no image
 * prefix is allowed and no `data:` image, so `![x](https://…)` draws nothing; links keep Streamdown's own
 * protocols and ask the reader first.
 */
const SAFE: NonNullable<StreamdownProps["rehypePlugins"]> = [
  defaultRehypePlugins.raw!,
  defaultRehypePlugins.sanitize!,
  [(defaultRehypePlugins.harden as [never])[0], { allowedImagePrefixes: [], allowedLinkPrefixes: ["*"], allowDataImages: false }],
];

/** `MessageText`'s cascade, so the two components keep the same rhythm. See its docblock. */
const STAGGER = 18;

export const MessageMarkdown = (props: MessageMarkdownProps) => {
  const { children, streaming = false, className, slot, ...rest } = props;

  return (
    // The element exists so the part has one. `Streamdown` renders a `div` of its own but drops
    // every prop it does not consume — measured, not assumed, and `markdown.test.tsx` is what keeps
    // it measured: `data-slot` and `data-streaming` handed to it reach no attribute at all. So the
    // two things a consumer selects on are written here, on an element we own, and only
    // Streamdown's own options are passed down.
    <div
      className={cn("min-w-0 break-words", className)}
      data-streaming={streaming || undefined}
      data-slot={slot ?? "message-markdown"}
    >
      <Streamdown
        animated={streaming ? { sep: "word", stagger: STAGGER } : false}
        // Streamdown's own caret, rather than the `<span>` `MessageText` draws: it belongs at the
        // end of the last *rendered* block, which only the renderer knows — a caret appended by us
        // would sit after a table rather than inside the paragraph the model is still writing.
        caret={streaming ? "block" : undefined}
        mode={streaming ? "streaming" : "static"}
        // The whole point. `false` renders `**bo` as two asterisks and a `bo`.
        parseIncompleteMarkdown={streaming}
        linkSafety={{ enabled: true }}
        rehypePlugins={SAFE}
        {...rest}
      >
        {children}
      </Streamdown>
    </div>
  );
};
