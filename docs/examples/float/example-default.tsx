import { Badge, Float } from "@kanzo-tech/ui";
import { BellIcon } from "lucide-react";

export default function Example() {
  return (
    // Float anchors to the nearest positioned ancestor — note the `relative`.
    <div className="relative inline-flex size-10 items-center justify-center rounded-lg border">
      <BellIcon className="size-5 text-muted-foreground" />
      <Float className="-end-1.5 -top-1.5" placement="top-end">
        <Badge className="rounded-full" size="xs" variant="destructive">
          3
        </Badge>
      </Float>
    </div>
  );
}
