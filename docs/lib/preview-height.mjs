// How tall a `<ComponentPreview>` frame is. `components/component-preview.tsx` applies the rule and
// `scripts/measure-previews.mjs` writes and checks the numbers it reads, so it lives in one plain
// module both can import.
//
// Two sources, most specific first: the number measured on the rendered example
// (`components/preview-heights.json`), then a height derived from the source's line count. The
// measured number is published as `max(FLOOR, FLOORS[key], resting)`, and refused past `CEILING`.
//
// The line count sizes the Code pane and not the Preview: measured 2026-08-21 over 342 previews, the
// median derived frame carried 183px of empty space and 72 % sat on the cap. Measuring is done at
// build time rather than in the browser, so the first paint is right and nothing resizes on load.

/** The preview's floor, not the code's. A 36px `Button` in it, less the frame's 24px padding,
 *  leaves 38px above and below: under 40, which is where a band of nothing starts to read as a hole
 *  (the 220 this replaced left 52 inside the old guides). */
export const FLOOR = 160;

/** The derived height's cap, Shark's 450. A measured number may go past it. */
export const CAP = 450;

/** A refusal: past it something is stretching without bound, and a frame taller than a viewport is
 *  not a fix. The sweep leaves such a key derived and says so. */
export const CEILING = 900;

/**
 * The line box is 20px — 14px mono at 1.4286 — and the scrolling viewport adds 14px top and
 * bottom. Px and not `rem` on purpose: the code face is set in px, so its line box does not move
 * with the density axis.
 */
const LINE = 20;
const VIEWPORT_PAD = 28;

/**
 * Per-example floors, for the case the sweep structurally cannot measure: **an example that only
 * grows when somebody interacts with it.** A floor rather than a fixed height, so the probe still
 * wins when the resting layout grows past it. Add an entry only with the number measured with the
 * thing open, and say what opened it.
 *
 * **A preview that overflows at rest does not belong here.** Swept 2026-08-23 over all 321 keyed
 * previews at 1920×1080, seven overflowed their shipped frame, and every one probed non-stretchy at
 * exactly the height its content needed: a stale number, which re-running the sweep corrects, not a
 * blind spot a floor should pin.
 */
export const FLOORS = {
  // `Assist`'s chips arrive on a press and render only while the field has focus. Measured live on
  // the old fields page: 186px at rest, 296px with four candidates open. Not yet re-measured here.
  "assist/example-input": 300,
  "assist/example-tags": 300,

  // Walked with the frame unconstrained: 434 on arrival, 718 at the second question and 774 from
  // the third on. The probe loads question one, so the floor is the tallest state.
  "questionnaire/example-default": 780,
};

/** The height a measured resting size publishes as, or `null` past the ceiling. */
export function published(key, resting) {
  const px = Math.max(FLOOR, FLOORS[key] ?? 0, resting);
  return px > CEILING ? null : px;
}

/** From the code it holds, for a key the sweep has not published. */
export function derived(source) {
  return Math.round(Math.min(CAP, Math.max(FLOOR, source.split("\n").length * LINE + VIEWPORT_PAD)));
}

/** The frame height for one example: measured if published, else derived. */
export function frameHeight(key, source, measured) {
  return measured[key] ?? derived(source);
}
