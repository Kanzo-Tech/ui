import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CodeBlockProps } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { ComponentPreviewTabs } from "./component-preview-tabs";
import { isFullBleedComponent } from "@/lib/component-groups";

const EXAMPLES_PATH = "examples";

/**
 * The code pane holds the preview pane's 450px exactly, so switching tabs never shifts the page,
 * and drops the codeblock's own frame — the tabs wrapper draws that once around both panes.
 */
const CODE_PANE = {
  className: "rounded-none border-0 shadow-none",
  viewportProps: { className: "h-[450px] max-h-none" },
} satisfies CodeBlockProps;

export interface ComponentPreviewProps {
  /** Directory under `docs/examples` — usually the component slug. */
  componentName: string;
  /** File basename, no extension. */
  fileName?: string;
  /**
   * Render the example whole: no frame padding, no centring, no fixed height, no guides.
   *
   * Left undefined it is **derived** — a page in the `layouts` or `blocks` group is full-bleed,
   * everything else is framed. Pass it explicitly only to override that for one example.
   */
  fullBleed?: boolean;
  /** Preview pane is a fixed 450px so switching tabs never makes the page jump. */
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

  // A shell cannot be judged inside a 450px centred box with dashed padding guides — that frame
  // is built for a button. Which components need the frame is not a property of the example, so
  // it is not an MDX prop by default: it is read off the group the component's page sits in.
  const fullBleed = props.fullBleed ?? isFullBleedComponent(componentName);
  const hasMaxHeight = props.hasMaxHeight ?? !fullBleed;
  const showBorders = props.showBorders ?? !fullBleed;

  const Example = await import(`../examples/${componentName}/${fileName}.tsx`);
  if (!Example.default) {
    throw new Error(`No default export in examples/${componentName}/${fileName}.tsx`);
  }

  const examplePath = join(process.cwd(), EXAMPLES_PATH, componentName, `${fileName}.tsx`);
  const source = readFileSync(examplePath, "utf-8");

  return (
    <ComponentPreviewTabs
      component={<Example.default />}
      fullBleed={fullBleed}
      hasMaxHeight={hasMaxHeight}
      showBorders={showBorders}
      source={<ServerCodeBlock code={forDisplay(source)} codeblock={CODE_PANE} lang="tsx" />}
    />
  );
};

/**
 * Rewrite the source so a reader sees the imports THEY would write. Shark does the same when
 * mapping its registry path onto `@/components/ui`.
 */
function forDisplay(input: string) {
  return input
    .replace(/^import .*from "@kanzo-tech\/ui";$/gm, (line) => line)
    .replace(/\n+$/, "");
}
