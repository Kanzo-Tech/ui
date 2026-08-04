import { Slider, SliderLabel, SliderValue } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Slider className="w-72" defaultValue={[32]} max={200}>
      <div className="flex items-center">
        <SliderLabel>Reward, in gold</SliderLabel>
        <SliderValue />
      </div>
    </Slider>
  );
}
