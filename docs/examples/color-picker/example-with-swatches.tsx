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
  ColorPickerTransparencyGrid,
  ColorPickerTrigger,
  ColorPickerValue,
  ColorPickerValueSwatch,
} from "@kanzo-tech/ui";
import { HALLS, hall } from "@/example/world";

const HERALDRY = HALLS.map((entry) => entry.heraldry.brand);

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

        {/* The alpha slider carries a TransparencyGrid so its track reads against a
            checkerboard. */}
        <ColorPickerEyeDropperTrigger />
        <ColorPickerSlider channel="hue" />
        <ColorPickerSlider channel="alpha">
          <ColorPickerTransparencyGrid />
        </ColorPickerSlider>

        <ColorPickerSwatchGroup>
          {HERALDRY.map((color) => (
            <ColorPickerSwatchTrigger key={color} value={color}>
              {/* The indicator is a CHILD of the swatch, not a sibling: `Swatch` is what
                  provides the swatch context the indicator reads, so hoisting it up to the
                  trigger throws at render time. */}
              <ColorPickerSwatch value={color}>
                <ColorPickerSwatchIndicator />
              </ColorPickerSwatch>
            </ColorPickerSwatchTrigger>
          ))}
        </ColorPickerSwatchGroup>
      </ColorPickerContent>
    </ColorPicker>
  );
}
