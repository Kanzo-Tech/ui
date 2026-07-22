import { cn } from "@kanzo-tech/ui";

/**
 * Full-page block preview, matching Shark UI's `PreviewIframe`.
 *
 * Blocks are whole screens — an app shell, an IDE workspace — and they only tell you anything
 * at full viewport. An iframe gives them their own layout context so the docs chrome around
 * them does not distort what you are judging.
 */
export const PreviewIframe = ({
  name,
  title,
  className,
}: {
  name: string;
  title?: string;
  /** 450px is a floor, not a target — a whole shell usually wants an explicit height. */
  className?: string;
}) => (
  <iframe
    className={cn("min-h-[450px] w-full rounded-2xl border", className)}
    src={`/view/blocks/${name}`}
    title={title ?? `${name} block preview`}
  />
);
