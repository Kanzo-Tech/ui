import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Default</Button>
        </SheetTrigger>

        <SheetContent>
          <SheetHeader title="Flush to the edge" />
          <SheetBody>Full-bleed against the viewport, with a single border on the inner edge.</SheetBody>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">Inset</Button>
        </SheetTrigger>

        <SheetContent variant="inset">
          <SheetHeader title="Inset" />
          <SheetBody>Floats with a margin and rounded corners from the `sm` breakpoint up.</SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
