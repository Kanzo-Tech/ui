import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@kanzo-tech/ui";

const PLACEMENTS = ["top", "right", "bottom", "left"] as const;

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PLACEMENTS.map((placement) => (
        <Tooltip key={placement} positioning={{ placement }}>
          <TooltipTrigger asChild>
            <Button size="sm" variant="outline">
              {placement}
            </Button>
          </TooltipTrigger>

          <TooltipContent>Placed {placement}.</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
