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
        <Button variant="outline">Terms</Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-muted-foreground text-sm">
        Grade 5 — a writ. Ashfall Reach, eleven days out from Thornmarch.
      </CollapsibleContent>
    </Collapsible>
  );
}
