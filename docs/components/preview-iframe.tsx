import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cn } from "@kanzo-tech/ui";
import type { CodeBlockProps } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { PreviewIframeTabs } from "./preview-iframe-tabs";

/** No frame of its own — the tabs wrapper draws one around both panes. */
const CODE_PANE = {
  className: "rounded-none border-0 shadow-none",
  viewportProps: { className: "max-h-[820px]" },
} satisfies CodeBlockProps;

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

  // **Prefixed by hand, and the trailing slash is not decoration.** An `iframe`'s `src` and an
  // `<a href>` built as a string are not URLs Next rewrites — only `Link` and `next/image` get the
  // `basePath` for free — so under a project page at `/ui` a bare `/view/showcases/x` points at the
  // ORG's root, outside this site entirely, and every showcase on every page is a 404 inside a box.
  // The slash matches `trailingSlash: true`: the export writes `…/x/index.html`, and a static host
  // has no redirect to offer the version without it. Same variable as the corpus path in
  // `showcases/workspace/graph-state.tsx`; empty in development.
  const href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/view/showcases/${name}/`;

  const iframe = (
    <iframe
      className={cn("min-h-[450px] w-full", className)}
      src={href}
      title={title ?? `${name} showcase preview`}
    />
  );

  return (
    <PreviewIframeTabs
      fullUrl={href}
      iframe={iframe}
      source={
        code ? <ServerCodeBlock code={code} codeblock={CODE_PANE} lang="tsx" /> : undefined
      }
    />
  );
};
