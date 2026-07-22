import { Slider } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Slider
      className="w-72"
      defaultValue={[6]}
      markerInterval={2}
      max={10}
      showMarkers
    />
  );
}
