import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Collapsible className="w-full max-w-sm" defaultOpen>
      <CollapsibleTrigger asChild>
        <Button variant="outline">Toggle details</Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-muted-foreground text-sm">
        This region animates its height open and closed.
      </CollapsibleContent>
    </Collapsible>
  );
}
