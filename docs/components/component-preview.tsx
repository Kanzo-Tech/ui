import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeBlockProps } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { ComponentPreviewTabs } from "./component-preview-tabs";
import measured from "./preview-heights.json";

const EXAMPLES_PATH = "examples";

/**
 * How tall one example's frame is, from the code it holds rather than from a constant.
 *
 * **Both panes get the same number**, which is what the 450px constant was buying: switch tabs and
 * the page below does not move. What the constant also bought was a void — the `Button` example is
 * five lines in a 450px box, 73 % of it empty — and a letterbox, which is the far commoner
 * complaint: measured over `docs/examples/**\/*.tsx` on 2026-08-20, **351 examples, of which 281
 * (80 %) are longer than the 17 lines that fit, and 150 (43 %) run past two panefuls.** A constant
 * cannot be right for both ends of that.
 *
 * The line box is 18.57px — 13px mono at 1.4286 — and the scrolling viewport adds 14px top and
 * bottom. Those are px and not `rem` on purpose: the code face is set in px, so its line box does
 * not move with the density axis, and a `rem` here would drift against the text it is measuring.
 *
 * The floor is the preview's, not the code's: a `Button` is 36px tall and would sit in a frame
 * shorter than its own dashed guides. The cap is Shark's 450.
 */
const LINE = 18.5714;
const VIEWPORT_PAD = 28;
const FLOOR = 220;
const CAP = 450;

const frameHeight = (source: string) =>
  Math.round(Math.min(CAP, Math.max(FLOOR, source.split("\n").length * LINE + VIEWPORT_PAD)));

/**
 * The code pane fills the frame and drops the codeblock's own border — the tabs wrapper draws that
 * once around both panes.
 *
 * `title` is the file, so the copy button gets a bar to live in instead of floating over the first
 * line of code, and a reader can see *which* file they are copying. Line numbers are on because
 * four in five of these scroll: without them there is nothing that says how far in you are.
 */
const codePane = (height: number | undefined, title: string) =>
  ({
    // The height goes on the FIGURE, not on the scrolling viewport, and the viewport flexes into
    // what is left. Put it on the viewport instead and the title bar stacks on top of it — the two
    // panes then differ by exactly the bar (measured 38px: 20 of text, 18 of padding), which is the
    // page-shift this whole arrangement exists to avoid.
    className: "flex flex-col rounded-none border-0 shadow-none",
    style: height ? { height } : undefined,
    title,
    "data-line-numbers": true,
    // No height at all when the frame is uncapped: a full-bleed example brings its own container
    // and its source should run to its natural length rather than into a scroller.
    viewportProps: { className: "max-h-none min-h-0 flex-1" },
  }) satisfies CodeBlockProps;

export interface ComponentPreviewProps {
  /** Directory under `docs/examples` — usually the component slug. */
  componentName: string;
  /** File basename, no extension. */
  fileName?: string;
  /**
   * Render the example whole: no frame padding, no centring, no fixed height, no guides.
   *
   * Per example, not per group. Two slugs need it — `shell` and `sidebar` — and both sit in
   * groups whose other pages are single elements, so there is no group rule to derive it from.
   */
  fullBleed?: boolean;
  /** Cap the frame. Off, the panes take whatever their content needs. */
  hasMaxHeight?: boolean;
  /**
   * The frame height in px, for an example that **renders** taller than its source is long.
   *
   * The derived number counts lines of code, which is a good proxy right up until it is not: a
   * transcript, a shell or a chart is a few lines that paint a page. `docs/ai/tool` measured 583px
   * of content in the 450px cap and scrolled, and the reader met it already scrolled, because the
   * transcript inside pins to its own tail.
   *
   * It goes on **both** panes, like the derived one, so switching Preview/Code still does not move
   * the page — which is the whole reason the two share a number. Reach for it per example and not
   * per group: it is a fact about what one example paints.
   *
   * **The number is the example's TALLEST state, and the tall states are behind an interaction.**
   * A sweep of the ten AI pages found exactly one overflow at first paint; `forms/questionnaire`
   * measured 450 in 450 on arrival and **612 in 450 by its second question**, because a later
   * question is a taller card. Nothing derivable at build time can see that — the line count cannot,
   * and neither can a screenshot of the first render. Walk the example before choosing the number.
   */
  height?: number;
  /** The dashed padding guides around the preview. */
  showBorders?: boolean;
}

/**
 * Renders a live example next to its own source.
 *
 * This is Shark UI's mechanism, not a reimplementation of it: an async Server Component that
 * `import()`s the example for the live element and `readFileSync`s the very same path for the
 * text. One file is the single source of both, so the code shown can never drift from the
 * component rendered above it — which is exactly what a hand-written snippet cannot promise.
 * It runs at build time.
 */
export const ComponentPreview = async (props: ComponentPreviewProps) => {
  const { componentName, fileName = "example-default" } = props;

  // A shell cannot be judged inside a centred box with dashed padding guides — that frame is
  // built for a button.
  const fullBleed = props.fullBleed ?? false;
  const hasMaxHeight = props.hasMaxHeight ?? !fullBleed;
  const showBorders = props.showBorders ?? !fullBleed;

  const Example = await import(`../examples/${componentName}/${fileName}.tsx`);
  if (!Example.default) {
    throw new Error(`No default export in examples/${componentName}/${fileName}.tsx`);
  }

  const examplePath = join(process.cwd(), EXAMPLES_PATH, componentName, `${fileName}.tsx`);
  const source = readFileSync(examplePath, "utf-8");
  const shown = forDisplay(source);

  // The path a reader would open, not the absolute one this build happens to read.
  const title = `${EXAMPLES_PATH}/${componentName}/${fileName}.tsx`;
  // Three sources, most-specific first.
  //
  // **The measured number is what removes the letterbox.** The derived one counts lines of code,
  // which sizes the Code pane correctly and the Preview pane not at all: measured 2026-08-21 over
  // 342 previews, the median frame carried 183px of empty space and only 41 landed within 40px of
  // right — and 72 % of frames sat on the cap, so the "derivation" was Shark's constant wearing a
  // formula for three quarters of the corpus. No calibration of `LINE`, `FLOOR` or `CAP` fixes a
  // distribution; only measuring the rendered thing does.
  //
  // It is measured at BUILD time by `scripts/measure-previews.mjs` rather than in the browser,
  // which is the whole point: a client measurement would be right and would resize every frame once
  // per page load, forever, to learn a number that does not change between deploys. This way the
  // first paint is already correct and there is no settle at all.
  const key = `${componentName}/${fileName}`;
  const height = hasMaxHeight
    ? (props.height ?? (measured as Record<string, number>)[key] ?? frameHeight(shown))
    : undefined;

  return (
    <ComponentPreviewTabs
      component={<Example.default />}
      fullBleed={fullBleed}
      height={height}
      // Only an example whose height is still up for measurement carries a key.
      measureKey={hasMaxHeight && props.height === undefined ? key : undefined}
      showBorders={showBorders}
      source={
        <ServerCodeBlock
          code={shown}
          codeblock={codePane(height, title)}
          lang="tsx"
        />
      }
    />
  );
};

/**
 * Rewrite the source so a reader sees what they would have to write.
 *
 * `@kanzo-tech/*` imports are already the reader's own — they pass through untouched. A `@/`
 * import is not: it resolves inside this site and nowhere else, so the Code tab was showing an
 * import a reader could copy and never satisfy. Those get an inline note saying where the file
 * is, because they are arrangements you copy rather than API you install — the same thing the
 * charts page says in prose about `docs/lib/`.
 */
function forDisplay(input: string) {
  return input
    .replace(
      /^(import .*from "@\/(\S+)";)$/gm,
      (_line, statement: string, path: string) => `${statement} // copy from docs/${path}.tsx`,
    )
    .replace(/\n+$/, "");
}
