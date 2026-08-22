"use client";

import { ark } from "@ark-ui/react/factory";
import * as React from "react";
import { cn } from "@kanzo-tech/ui";

/**
 * A streamed answer, arriving a word at a time.
 *
 * The shape is Streamdown's, which is what AI Elements renders an answer and a reasoning block
 * with — `packages/streamdown/lib/animate.ts` and its `styles.css`. Four things are taken from it
 * and each one is a bug this component would otherwise have:
 *
 * 1. **A word, not a chunk.** A model emits tokens and tokens cut words in half; animating what
 *    arrives makes half a word fade in and the other half a frame later. Streamdown splits the
 *    same way and glues the trailing whitespace onto the word before it, so a partial answer never
 *    ends on a naked space either.
 * 2. **Only what is new animates.** Words already on screen are not re-run. Here that falls out of
 *    the key: each word is keyed by its absolute character offset, so React keeps the elements it
 *    already mounted. Keyed by the word itself, the last one remounts on every frame while its own
 *    characters are still arriving — its arrival restarts each time and it flashes instead of
 *    settling. The text only ever grows at the end, which is what makes the offset stable.
 * 3. **A stagger, so a batch cascades instead of flashing.** A stream does not deliver one word per
 *    frame; it delivers twenty at once and then nothing for 200ms. Without a per-word delay the
 *    twenty fade in together, which is a flash — the thing the animation exists to avoid.
 * 4. **A budget on the cascade.** {@link MAX_CASCADE} is Streamdown's `MAX_ANIMATION_BACKLOG_MS`.
 *    A stagger applied naively to a fast stream schedules words further and further ahead of the
 *    text, so an unbounded queue of `opacity: 0` words builds up behind a stream that has already
 *    finished. Compressing the step to fit the budget — floored at {@link MIN_STEP}, so the batch
 *    still cascades rather than collapsing to zero — is what keeps the paint caught up.
 *
 * What is NOT taken, and it is the gap to know about: Streamdown exists mostly to render
 * **incomplete markdown**, closing an unterminated `**bold` or a half-arrived code fence so the
 * answer does not flicker as it completes. This takes a plain string and renders it as text, which
 * has no such problem and also no markdown. A source that streams markdown into this will want
 * that, and it is a dependency rather than a rewrite.
 *
 * Reduced motion is `motion-reduce:animate-none`: with the animation off the words are already at
 * their settled opacity, so there is nothing to unwind.
 */
export interface MessageTextProps
  extends Omit<React.ComponentProps<typeof ark.div>, "children"> {
  /** The answer so far. Grows; never rewritten. */
  children: string;
  /** More is coming. Draws the caret, and nothing else — the arrival is per word. */
  streaming?: boolean;
}

/** A run of non-space plus the space that follows it, so the whitespace travels with its word. */
const WORD = /\S+\s*/g;

/** Milliseconds between two words of one batch, before the budget below compresses it. */
const STAGGER = 18;
/** How far ahead of the text a batch may schedule. Streamdown's `MAX_ANIMATION_BACKLOG_MS`. */
const MAX_CASCADE = 320;
/** The step never falls below this, so a compressed batch still cascades. Streamdown's floor. */
const MIN_STEP = 4;

export const MessageText = (props: MessageTextProps) => {
  const { children, streaming = false, className, slot, ...rest } = props;

  // What was on screen when the last render committed. **A message that mounts complete did not
  // arrive**, so one that is not streaming at mount starts with all of it settled and animates
  // nothing — a transcript loaded from history should not replay itself.
  const settled = React.useRef(streaming ? 0 : children.length);

  const words = [...children.matchAll(WORD)];
  const from = words.findIndex((word) => word.index >= settled.current);
  const fresh = from < 0 ? 0 : words.length - from;
  const step =
    fresh > 1 ? Math.max(MIN_STEP, Math.min(STAGGER, MAX_CASCADE / (fresh - 1))) : STAGGER;

  // After paint, not during render: a ref written in the render body is wrong under StrictMode's
  // double invoke, which is the same hazard Streamdown answers with `mark`/`rewind`.
  React.useLayoutEffect(() => {
    settled.current = children.length;
  });

  return (
    <ark.div
      className={cn("min-w-0 whitespace-pre-wrap break-words", className)}
      data-streaming={streaming || undefined}
      {...rest}
      data-slot={slot ?? "message-text"}
    >
      {words.map((word, index) => {
        const arriving = from >= 0 && index >= from;
        return (
          <span
            className={cn(arriving && "animate-arrive motion-reduce:animate-none")}
            key={word.index}
            style={arriving ? { animationDelay: `${Math.round((index - from) * step)}ms` } : undefined}
          >
            {word[0]}
          </span>
        );
      })}
      {/* Always rendered, hidden rather than unmounted: a component that renders one shape while
          streaming and another when done re-mounts every word at the moment it finishes, and the
          whole answer arrives a second time. `aria-hidden` because a caret is not content — the
          live region that announces the turn is the caller's. */}
      <span
        aria-hidden
        className={cn(
          "ms-0.5 inline-block h-[1em] w-[0.5ch] align-[-0.1em] bg-current",
          "animate-pulse motion-reduce:animate-none",
          !streaming && "hidden",
        )}
        data-slot="message-caret"
      />
    </ark.div>
  );
};
