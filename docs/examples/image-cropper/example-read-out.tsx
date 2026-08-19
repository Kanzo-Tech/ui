"use client";

import {
  ImageCropper,
  ImageCropperImage,
  ImageCropperSelection,
  useImageCropper,
} from "@kanzo-tech/ui";

/** Inside the cropper, because the api arrives through the root's context and nowhere else. */
function Readout() {
  const cropper = useImageCropper();
  const { width, height } = cropper.naturalSize;

  if (!width || !height) return null;

  const crop = cropper.getCropData();
  const percent = (n: number, of: number) => `${((n / of) * 100).toFixed(1)}%`;

  return (
    <p className="pointer-events-none absolute inset-x-0 bottom-0 bg-card/90 p-2 text-center text-muted-foreground text-xs tabular-nums">
      {Math.round(crop.width)}×{Math.round(crop.height)} of {width}×{height} · from{" "}
      {percent(crop.x, width)}, {percent(crop.y, height)}
    </p>
  );
}

export default function Example() {
  return (
    <ImageCropper className="aspect-[4/3] max-w-lg">
      <ImageCropperImage alt="A surveyor's map of the Guild's six regions" src="/example/guild-map.svg" />
      <ImageCropperSelection />
      <Readout />
    </ImageCropper>
  );
}
