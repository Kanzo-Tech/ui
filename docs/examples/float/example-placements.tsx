import { Badge, Float } from "@kanzo-tech/ui";

const PLACEMENTS = [
  "top-start",
  "top-center",
  "top-end",
  "middle-start",
  "middle-center",
  "middle-end",
  "bottom-start",
  "bottom-center",
  "bottom-end",
] as const;

export default function Example() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {PLACEMENTS.map((placement) => (
        <div
          className="relative flex h-16 w-28 items-center justify-center rounded-lg border text-muted-foreground text-xs"
          key={placement}
        >
          {placement}
          <Float placement={placement}>
            <Badge size="xs" variant="outline">
              •
            </Badge>
          </Float>
        </div>
      ))}
    </div>
  );
}
