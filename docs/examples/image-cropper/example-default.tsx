import { ImageCropper, ImageCropperImage, ImageCropperSelection } from "@kanzo-tech/ui";
import { asset } from "@/example/assets";

export default function Example() {
  return (
    <ImageCropper className="aspect-[4/3] max-w-lg">
      <ImageCropperImage alt="A surveyor's map of the Guild's six regions" src={asset("guild-map.svg")} />
      <ImageCropperSelection />
    </ImageCropper>
  );
}
