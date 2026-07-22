import {
  Button,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@kanzo-tech/ui";

const PLACEMENTS = ["top", "right", "bottom", "left"] as const;

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PLACEMENTS.map((placement) => (
        <Sheet key={placement}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline">
              {placement}
            </Button>
          </SheetTrigger>

          <SheetContent placement={placement}>
            <SheetHeader title={`placement="${placement}"`} />
            <SheetBody>The slide-in direction follows the edge it is docked to.</SheetBody>
          </SheetContent>
        </Sheet>
      ))}
    </div>
  );
}
