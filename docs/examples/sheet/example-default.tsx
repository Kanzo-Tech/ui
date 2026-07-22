import {
  Button,
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Open details</Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader
          description="customers.ttl · 1,204 triples"
          title="Dataset details"
        />

        <SheetBody>
          Sheets keep the page behind them visible, so they suit inspecting a record without
          losing your place in the list.
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
