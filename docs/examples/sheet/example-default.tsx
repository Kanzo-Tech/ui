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
        <Button variant="outline">Open member</Button>
      </SheetTrigger>

      <SheetContent>
        <SheetHeader
          description="Warden · The Amber Hall · Gold · 71 settled"
          title="Ravenna Sarkis"
        />

        <SheetBody>
          Claimed for Q-1070, “The children say the well talks”, due 27 September. The roster
          stays visible behind the panel, so reading one member does not lose your place in it.
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
