import {
  Button,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
} from "@kanzo-tech/ui";

const PLACEMENTS = ["top", "right", "bottom", "left"] as const;

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PLACEMENTS.map((placement) => (
        <Popover key={placement} positioning={{ placement }}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              {placement}
            </Button>
          </PopoverTrigger>

          <PopoverContent>
            <PopoverArrow />
            <PopoverBody>Anchored {placement}.</PopoverBody>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
