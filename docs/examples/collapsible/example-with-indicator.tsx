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
          Party of five
          <CollapsibleIndicator />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-md border p-3 text-muted-foreground text-sm">
        Halla Grieve, Ludmila Vrána, Yusra Halim, Faisal Amari and Cuthbert Lyle — five
        names from four halls.
      </CollapsibleContent>
    </Collapsible>
  );
}
