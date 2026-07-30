import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentPreviewTabs } from "./component-preview-tabs";
import { CodeBlock } from "./code-block";
import { isFullBleedComponent } from "@/lib/component-groups";

const EXAMPLES_PATH = "examples";

export interface ComponentPreviewProps {
  /** Directory under `docs/examples` — usually the component slug. */
  componentName: string;
  /** File basename, no extension. */
  fileName?: string;
  /**
   * Render the example whole: no frame padding, no centring, no fixed height, no guides.
   *
   * Left undefined it is **derived** from the group the component's page sits in, via
   * `isFullBleedComponent`. Pass it explicitly for a page whose group is otherwise framed —
   * every sidebar and shell example does.
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
      source={<CodeBlock code={forDisplay(source)} lang="tsx" />}
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
