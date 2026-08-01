import {
  Button,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Filters</Button>
      </PopoverTrigger>

      <PopoverContent className="w-72">
        <PopoverHeader
          description="Narrow the contracts shown on the board."
          title="Filters"
        />

        <PopoverBody>Status, region and grade apply to this hall's board only.</PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
