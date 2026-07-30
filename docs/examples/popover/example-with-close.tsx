import {
  Button,
  Popover,
  PopoverBody,
  PopoverContent,
  PopoverFooter,
  PopoverHeader,
  PopoverTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Post a contract</Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" showCloseButton>
        <PopoverHeader
          description="It goes up as Open, and any chartered hall may claim it."
          title="Post a contract"
        />

        <PopoverBody>Grade, region and reward can still be amended while it is open.</PopoverBody>

        <PopoverFooter>
          <Button size="sm">Seal and post</Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
