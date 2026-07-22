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
        <Button variant="outline">Share graph</Button>
      </PopoverTrigger>

      <PopoverContent className="w-80" showCloseButton>
        <PopoverHeader
          description="Anyone with the link can read this graph."
          title="Share"
        />

        <PopoverBody>The link expires after 30 days.</PopoverBody>

        <PopoverFooter>
          <Button size="sm">Copy link</Button>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
}
