import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ComponentPreviewTabs } from "./component-preview-tabs";
import { CodeBlock } from "./code-block";

const EXAMPLES_PATH = "examples";

export interface ComponentPreviewProps {
  /** Directory under `docs/examples` — usually the component slug. */
  componentName: string;
  /** File basename, no extension. */
  fileName?: string;
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
  const {
    componentName,
    fileName = "example-default",
    hasMaxHeight = true,
    showBorders = true,
  } = props;

  const Example = await import(`../examples/${componentName}/${fileName}.tsx`);
  if (!Example.default) {
    throw new Error(`No default export in examples/${componentName}/${fileName}.tsx`);
  }

  const examplePath = join(process.cwd(), EXAMPLES_PATH, componentName, `${fileName}.tsx`);
  const source = readFileSync(examplePath, "utf-8");

  return (
    <ComponentPreviewTabs
      component={<Example.default />}
      hasMaxHeight={hasMaxHeight}
      showBorders={showBorders}
      source={<CodeBlock code={forDisplay(source)} lang="tsx" />}
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
