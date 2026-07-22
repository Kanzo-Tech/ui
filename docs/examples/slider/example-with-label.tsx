import { Slider, SliderLabel, SliderValue } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Slider className="w-72" defaultValue={[40]}>
      <div className="flex items-center">
        <SliderLabel>Sample size</SliderLabel>
        <SliderValue />
      </div>
    </Slider>
  );
}
