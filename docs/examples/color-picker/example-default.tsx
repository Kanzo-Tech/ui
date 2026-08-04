import {
  Button,
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerSlider,
  ColorPickerTrigger,
  ColorPickerValue,
  ColorPickerValueSwatch,
} from "@kanzo-tech/ui";
import { hall } from "@/example/world";

export default function Example() {
  return (
    <ColorPicker defaultValue={hall("amber").heraldry.brand}>
      <ColorPickerControl>
        <ColorPickerTrigger asChild>
          <Button variant="outline">
            <ColorPickerValueSwatch className="size-4" />
            <ColorPickerValue />
          </Button>
        </ColorPickerTrigger>
      </ColorPickerControl>

      <ColorPickerContent>
        <ColorPickerArea>
          <ColorPickerAreaThumb />
        </ColorPickerArea>
        <ColorPickerSlider channel="hue" />
      </ColorPickerContent>
    </ColorPicker>
  );
}
