import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";

interface CodeBlockProps {
  code: string;
  lang?: string;
  /** Filename label above the block, as in Shark's install step. */
  title?: string;
}

/**
 * Shiki-highlighted block. Dual theme with `defaultColor: false`, so each token carries both
 * `--shiki-light` and `--shiki-dark` and CSS picks one — the theme toggle costs no re-render.
 */
export const CodeBlock = async ({ code, lang = "tsx", title }: CodeBlockProps) => {
  const html = await codeToHtml(code, {
    lang,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });

  return (
    <figure className="relative overflow-hidden rounded-2xl border bg-card" data-code-figure>
      {title && (
        <figcaption className="flex min-h-11 items-center border-b px-4 font-mono text-muted-foreground text-xs">
          {title}
        </figcaption>
      )}
      <CopyButton value={code} className="absolute inset-e-1.5 top-1.5 z-10" />
      <div
        className="overflow-auto [&_pre]:min-w-0 [&_pre]:bg-transparent! [&_pre]:px-4 [&_pre]:py-3.5 [&_pre]:text-[0.8125rem] [&_pre]:[tab-size:2]"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki output, built from our own source files at build time.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
};
