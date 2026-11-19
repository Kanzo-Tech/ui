import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@kanzo-tech/ui";

/** The upstream reference, drawn as one more of fumadocs' page actions beside it. */
export function UpstreamLinks({ className, links }: { className?: string; links?: { doc?: string } }) {
  if (!links?.doc) return null;

  return (
    <a
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors [&_svg]:size-3.5",
        className,
      )}
      href={links.doc}
      rel="noreferrer"
      target="_blank"
    >
      Ark UI
      <ExternalLinkIcon />
    </a>
  );
}
