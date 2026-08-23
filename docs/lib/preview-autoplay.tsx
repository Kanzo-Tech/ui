"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * A preview that demonstrates itself.
 *
 * Examples that are ABOUT motion — a stream arriving, a ghost being written — show nothing at
 * rest, so the page reads as a screenshot until the reader finds the button. This gives the
 * frame a way to cue the example once, and the example a way to decide what a cue means. It is
 * docs machinery only: nothing here is exported from `@kanzo-tech/ui`, and an example that opts
 * in is still a demonstration, not a second call site.
 *
 * **Why a context and not a robot.** The frame holds the rendered element and cannot reach
 * inside it — and a generic driver that searches for a button and clicks it would be a fake
 * reader whose failures look like the component's. So the cue carries no instruction: the frame
 * says *now*, and the example's own `useAutoplay` callback is the only thing that knows what
 * playing means for it. That also keeps the seam one-directional — an example with no
 * `useAutoplay` call is unaffected by the prop.
 */

/**
 * `play` animates; `settle` must land on the SAME finished state without animating, because the
 * reader asked for no motion, not for no content.
 */
export type AutoplayMode = "play" | "settle";

/** `nth` exists so a replay is a new value even when the mode is unchanged. */
interface AutoplayCue {
  readonly nth: number;
  readonly mode: AutoplayMode;
}

const AutoplayContext = createContext<AutoplayCue | null>(null);

/**
 * Half the preview pane. The pane `ComponentPreview` builds is a fixed 450px, so 0.5 is 225px of
 * it — reachable in any viewport this site is readable in, and high enough that a preview
 * clipping the bottom of the screen does not start a stream the reader cannot see. A ratio-based
 * threshold is what makes it *self*-relative: `rootMargin` would have to be re-tuned per pane
 * height, and full-bleed examples do not have one.
 */
const VISIBLE = 0.5;

export const PreviewAutoplayProvider = ({
  cue,
  children,
}: {
  cue: AutoplayCue | null;
  children: ReactNode;
}) => <AutoplayContext.Provider value={cue}>{children}</AutoplayContext.Provider>;

/**
 * The frame half: observe the pane, cue on entry, and stop for good once the reader acts.
 *
 * Returns the ref for the pane, the current cue to publish, and `halt`.
 */
export function usePreviewAutoplay(enabled: boolean) {
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const [cue, setCue] = useState<AutoplayCue | null>(null);

  // Once, not looped, and re-armed by leaving the viewport. A loop is what would make a stream
  // legible on a page you land in the middle of, and it is also what makes a docs page
  // exhausting — but the decisive argument is that every one of these examples ENDS in the state
  // that is the point (the completed text, the accepted ghost, the filled list), and a loop never
  // lets the reader read it. Scrolling away and back is the replay, which is also the gesture a
  // reader who missed it already makes.
  const armed = useRef(true);
  // Sticky, and deliberately not resettable: an example the reader has touched holds their state,
  // and a cue would throw it away. One touch ends autoplay for this preview for the page's life.
  const halted = useRef(false);
  const nth = useRef(0);

  useEffect(() => {
    if (!enabled || !pane) return;

    // A real media query, evaluated at cue time rather than at mount, so a reader who flips the
    // OS setting with the page open gets the answer they just chose.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.intersectionRatio >= VISIBLE) {
            if (halted.current || !armed.current) continue;
            armed.current = false;
            nth.current += 1;
            setCue({ nth: nth.current, mode: reduced.matches ? "settle" : "play" });
          } else if (!entry.isIntersecting) {
            // Fully gone, not merely below the threshold — otherwise a reader parked on the edge
            // of the pane re-triggers it with every scroll wheel notch.
            armed.current = true;
          }
        }
      },
      { threshold: [0, VISIBLE] },
    );

    observer.observe(pane);
    return () => observer.disconnect();
  }, [enabled, pane]);

  const halt = useCallback(() => {
    halted.current = true;
  }, []);

  return { paneRef: setPane, cue, halt };
}

/**
 * The example half: run `play` when the frame cues this preview.
 *
 * Outside a cueing frame the context is null and this does nothing at all, so the example is
 * unchanged wherever it is rendered without autoplay.
 */
export function useAutoplay(play: (mode: AutoplayMode) => void) {
  const cue = useContext(AutoplayContext);

  // Kept in a ref so the callback may close over fresh state without the cue effect re-running
  // on every render — and declared first, because effects run in declaration order, so this is
  // already up to date on the commit that delivers a new cue.
  const latest = useRef(play);
  useEffect(() => {
    latest.current = play;
  });

  useEffect(() => {
    if (cue) latest.current(cue.mode);
  }, [cue]);
}
