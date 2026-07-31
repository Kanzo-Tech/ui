import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@kanzo-tech/ui";

export function UpstreamLinks({ links }: { links?: { doc?: string } }) {
  if (!links?.doc) return null;

  return (
    <Badge asChild pill size="sm" variant="outline">
      <a href={links.doc} rel="noreferrer" target="_blank">
        Ark UI
        <ExternalLinkIcon />
      </a>
    </Badge>
  );
}
