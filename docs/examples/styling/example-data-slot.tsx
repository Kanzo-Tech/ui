import { Badge, Button, ButtonGroup, Separator } from "@kanzo-tech/ui";
import { HALLS } from "@/example/world";

/**
 * The second escape hatch: reach a part by the slot it publishes.
 *
 * Both rows are the same markup. The second sits under one selector that names
 * `[data-slot="badge"]` and squares every badge inside it — written here as a Tailwind arbitrary
 * variant so the example is one file, but `[data-slot="badge"] { border-radius: 0 }` in your own
 * stylesheet is the same reach.
 *
 * It is a contract rather than decoration: the library's own recipes select on these, which is why
 * a part writes its `data-slot` *after* the props you spread — a stray one in your props can never
 * delete the hook a recipe depends on.
 */
export default function Example() {
  const halls = HALLS.slice(0, 3);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm" id="as-drawn">
          As the recipe draws it
        </p>
        <Row halls={halls} labelledBy="as-drawn" />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm" id="under-slot">
          Under <code>[data-slot=&quot;badge&quot;]</code>
        </p>
        <div className="[&_[data-slot=badge]]:rounded-none">
          <Row halls={halls} labelledBy="under-slot" />
        </div>
      </div>
    </div>
  );
}

function Row({ halls, labelledBy }: { halls: (typeof HALLS)[number][]; labelledBy: string }) {
  return (
    <ButtonGroup aria-labelledby={labelledBy}>
      {halls.map((hall) => (
        <Button key={hall.id} size="sm" variant="outline">
          {hall.short}
          <Badge variant="secondary">{hall.founded}</Badge>
        </Button>
      ))}
    </ButtonGroup>
  );
}
