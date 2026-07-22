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
          description="Narrow the rows shown in the table."
          title="Filters"
        />

        <PopoverBody>Filters apply to the current view only.</PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
