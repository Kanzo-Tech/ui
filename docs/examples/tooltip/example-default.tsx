import { InfoIcon } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label="About grade 5" size="icon-md" variant="ghost">
          <InfoIcon />
        </Button>
      </TooltipTrigger>

      <TooltipContent>Grade 5 — a Writ. Requires a hall's seal and a written heir.</TooltipContent>
    </Tooltip>
  );
}
