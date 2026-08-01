import { Slider } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Slider
      className="w-72"
      defaultValue={[2]}
      markerLabels={["Errand", "Nuisance", "Contract", "Hazard", "Writ"]}
      max={4}
      showMarkers
    />
  );
}
