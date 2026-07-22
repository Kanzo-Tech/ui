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

export default function Example() {
  return (
    <ColorPicker defaultValue="#7c3aed">
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
