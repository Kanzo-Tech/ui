import { Badge, Button, Float } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex items-center gap-8">
      <div className="relative">
        <Button variant="outline">Export to Parquet</Button>
        <Float className="-end-2 -top-2" placement="top-end">
          <Badge size="xs" variant="info">
            Beta
          </Badge>
        </Float>
      </div>

      {/* Gating a region takes two things, and the second is the one people forget: dim it AND
          make it `inert`. `inert` rather than `aria-hidden`, so the feature stays readable —
          still telling the user it exists — while being unreachable by pointer, focus and
          assistive tech alike. */}
      <div className="relative">
        <div className="opacity-50" inert>
          <Button variant="outline">Publish to the catalogue</Button>
        </div>
        <Float className="-end-2 -top-2" placement="top-end">
          <Badge size="xs" variant="secondary">
            Coming soon
          </Badge>
        </Float>
      </div>
    </div>
  );
}
