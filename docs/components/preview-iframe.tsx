import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cn } from "@kanzo-tech/ui";
import { CodeBlock } from "./code-block";
import { PreviewIframeTabs } from "./preview-iframe-tabs";

/**
 * Full-page showcase preview: the live showcase in its own iframe, a Code tab with its source,
 * and an "Open full size" link to the standalone route. A showcase only reads at full viewport,
 * so the frame stays out of its way — the iframe is its own layout context.
 */
export const PreviewIframe = ({
  name,
  title,
  className,
  source,
}: {
  name: string;
  title?: string;
  /** 450px is a floor; a whole shell usually wants an explicit height. */
  className?: string;
  /** Source path under `showcases/`, without extension. Defaults to `<name>/default`. */
  source?: string;
}) => {
  let code: string | null = null;
  try {
    code = readFileSync(
      join(process.cwd(), "showcases", `${source ?? `${name}/default`}.tsx`),
      "utf-8",
    ).replace(/\n+$/, "");
  } catch {
    code = null;
  }

  const iframe = (
    <iframe
      className={cn("min-h-[450px] w-full", className)}
      src={`/view/showcases/${name}`}
      title={title ?? `${name} showcase preview`}
    />
  );

  return (
    <PreviewIframeTabs
      fullUrl={`/view/showcases/${name}`}
      iframe={iframe}
      source={code ? <CodeBlock code={code} lang="tsx" /> : undefined}
    />
  );
};
