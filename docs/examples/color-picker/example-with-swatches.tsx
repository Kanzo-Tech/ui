import {
  Button,
  ColorPicker,
  ColorPickerArea,
  ColorPickerAreaThumb,
  ColorPickerContent,
  ColorPickerControl,
  ColorPickerEyeDropperTrigger,
  ColorPickerSlider,
  ColorPickerSwatch,
  ColorPickerSwatchGroup,
  ColorPickerSwatchIndicator,
  ColorPickerSwatchTrigger,
  ColorPickerTrigger,
  ColorPickerValue,
  ColorPickerValueSwatch,
} from "@kanzo-tech/ui";

const PRESETS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#7c3aed"];

export default function Example() {
  return (
    <ColorPicker defaultValue="#3b82f6">
      <ColorPickerControl>
        <ColorPickerTrigger asChild>
          <Button variant="outline">
            <ColorPickerValueSwatch className="size-4" />
            <ColorPickerValue />
          </Button>
        </ColorPickerTrigger>
        <ColorPickerEyeDropperTrigger />
      </ColorPickerControl>

      <ColorPickerContent>
        <ColorPickerArea>
          <ColorPickerAreaThumb />
        </ColorPickerArea>
        <ColorPickerSlider channel="hue" />
        <ColorPickerSlider channel="alpha" />

        <ColorPickerSwatchGroup>
          {PRESETS.map((color) => (
            <ColorPickerSwatchTrigger key={color} value={color}>
              <ColorPickerSwatch value={color} />
              <ColorPickerSwatchIndicator />
            </ColorPickerSwatchTrigger>
          ))}
        </ColorPickerSwatchGroup>
      </ColorPickerContent>
    </ColorPicker>
  );
}
