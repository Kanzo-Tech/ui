import { InfoIcon } from "lucide-react";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label="About triples" size="icon-md" variant="ghost">
          <InfoIcon />
        </Button>
      </TooltipTrigger>

      <TooltipContent>A triple is a subject–predicate–object statement.</TooltipContent>
    </Tooltip>
  );
}
