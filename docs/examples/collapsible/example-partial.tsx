import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Collapsible className="w-full max-w-sm" collapsedHeight="4rem">
      <CollapsibleContent className="rounded-md border p-3 text-muted-foreground text-sm">
        The quarry has opened onto something. Ashfall Reach, grade 5 — a writ, and no hall
        signs a writ without its seal and a written heir. The party is five, borrowed
        across four charters: Halla Grieve, Ludmila Vrána, Yusra Halim, Faisal Amari and
        Cuthbert Lyle.
        <br />
        <br />
        Basilisks keep to quarries and cut stone. Yusra is the cantor, so the wards are
        hers; no open flame below the second gallery under any circumstances. They are
        afield, and no word is expected before the due date.
      </CollapsibleContent>
      <CollapsibleTrigger asChild>
        <Button className="mt-2" size="sm" variant="ghost">
          Read more
        </Button>
      </CollapsibleTrigger>
    </Collapsible>
  );
}
