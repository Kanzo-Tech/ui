import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleIndicator,
  CollapsibleTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Collapsible className="w-full max-w-sm">
      <CollapsibleTrigger asChild>
        <Button className="w-full" variant="outline">
          Advanced options
          <CollapsibleIndicator />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-muted-foreground text-sm">
        The indicator rotates its chevron off the open state, so the trigger needs no
        state of its own.
      </CollapsibleContent>
    </Collapsible>
  );
}
