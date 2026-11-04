import { Slider } from "@kanzo-tech/ui";

// A vertical slider fills its container's height, so the container is what sets it.
export default function Example() {
  return (
    <div className="h-48">
      <Slider defaultValue={[40]} orientation="vertical" />
    </div>
  );
}
