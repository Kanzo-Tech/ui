import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeBlockProps } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { ComponentPreviewTabs } from "./component-preview-tabs";
import { frameHeight } from "@/lib/preview-height.mjs";
import measured from "./preview-heights.json";

const EXAMPLES_PATH = "examples";

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
  /**
   * Cue the example to demonstrate itself when it scrolls into view.
   *
   * Opt-in per example and inert unless the example calls `useAutoplay` — an example that is
   * about motion shows nothing at rest, and a page of those reads as a wall of screenshots.
   * `docs/lib/preview-autoplay.tsx` holds the mechanism and the four decisions behind it.
   * Never set it on an example whose source is a live model call.
   */
  autoplay?: boolean;
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
  // Measured at build time by `scripts/measure-previews.mjs`, so the first paint is already right;
  // `lib/preview-height.mjs` holds the rule and its reasons.
  const key = `${componentName}/${fileName}`;
  const height = hasMaxHeight ? frameHeight(key, shown, measured) : undefined;

  return (
    <ComponentPreviewTabs
      autoplay={props.autoplay ?? false}
      component={<Example.default />}
      fullBleed={fullBleed}
      height={height}
      measureKey={hasMaxHeight ? key : undefined}
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
