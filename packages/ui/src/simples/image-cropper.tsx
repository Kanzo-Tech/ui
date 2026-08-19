// A box drawn on a photograph, and the photograph read back through it. Ark's image-cropper
// machine, Shark's appearance.
//
// Shark's `image-cropper.tsx`, adopted the day it got a renderer: the Receipts showcase lets a
// reader draw the box a row was read from, which is the only paper a row typed by hand has ever
// had. Four differences from the reference file, all of them house rules or
// classes that compile to nothing:
//
// - `data-slot` after the spread with a `slot` prop, per `data-slot.test.tsx`.
// - No `"use client"`. Nothing here is stateful — `client-boundary.test.ts` forbids the directive
//   on a file that only wraps Ark's own client modules.
// - `useImageCropper` is the CONTEXT hook, not the machine hook Shark binds it to. Shark ships no
//   `ImageCropperRootProvider`, so under its own binding the export cannot be reached from
//   anything Shark's file renders; every other `useX` here is the context hook, and the binding is
//   pinned in `image-cropper.test.tsx` where the comparison over names cannot see it.
// - Three class spellings emit no CSS and are corrected: `backface-visibility-hidden` (Tailwind v4
//   spells it `backface-hidden`, which the same file already uses on the image),
//   `inset-0_[33.33%]` (an arbitrary value whose bracket opened one token late, so the vertical
//   grid lines had no inset at all and collapsed onto the selection's inline start), and a
//   `[&[data-position=n]_*]:` left dangling with its utility missing, which is what the three
//   other edge handles spell as a fill.
//
// What a caller owes: Ark reports the crop in VIEWPORT coordinates, and only `getCropData()` on the
// machine api knows about zoom, rotation and flip. Persisting a crop means one or the other, never
// a mix — or `maxZoom={1}`, which pins the pan offset at zero and makes the two agree, because at
// zoom 1 the image exactly fills the viewport.

import {
  ImageCropper as ArkImageCropper,
  useImageCropperContext,
} from "@ark-ui/react/image-cropper";
import type React from "react";
import { cn } from "../lib/cn";

export const useImageCropper = useImageCropperContext;

export const ImageCropper = (props: React.ComponentProps<typeof ArkImageCropper.Root>) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkImageCropper.Root
      className={cn(
        "[--cropper-accent:var(--color-white)] [--cropper-handler-size:--spacing(2)] [--cropper-handler-width:--spacing(1)]",
        "relative",
        "w-full",
        "aspect-video",
        className,
      )}
      {...rest}
      data-slot={slot ?? "image-cropper"}
    >
      <ArkImageCropper.Viewport
        className={cn("size-full", "overflow-hidden")}
        data-slot="image-cropper-viewport"
      >
        {children}
      </ArkImageCropper.Viewport>
    </ArkImageCropper.Root>
  );
};

export const ImageCropperImage = (
  props: React.ComponentProps<typeof ArkImageCropper.Image>,
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkImageCropper.Image
      className={cn(
        "absolute top-0 left-0",
        "size-full object-contain",
        "select-none",
        "backface-hidden",
        "pointer-events-none",
        "origin-center",
        className,
      )}
      {...rest}
      data-slot={slot ?? "image-cropper-image"}
    />
  );
};

export interface ImageCropperSelectionProps
  extends React.ComponentProps<typeof ArkImageCropper.Selection> {
  /**
   * The axis of the grid to show.
   *
   * @default "both"
   */
  axis?: "horizontal" | "vertical" | "both";
}

export const ImageCropperSelection = (props: ImageCropperSelectionProps) => {
  const { axis = "both", className, children, slot, ...rest } = props;

  return (
    <ArkImageCropper.Selection
      className={cn(
        "shadow-[0_0_0_9999px_rgb(0_0_0/0.5)]",
        "border-2 border-white/64",
        "backface-hidden",
        "cursor-move",
        "data-[shape=circle]:rounded-full",
        "outline-none focus-visible:border-(--cropper-accent)",
        "data-disabled:cursor-default",
        "data-dragging:cursor-grabbing data-dragging:border-white/84",
        className,
      )}
      {...rest}
      data-slot={slot ?? "image-cropper-selection"}
    >
      {children}

      {(axis === "horizontal" || axis === "both") && <ImageCropperGrid axis="horizontal" />}
      {(axis === "vertical" || axis === "both") && <ImageCropperGrid axis="vertical" />}

      <ImageCropperHandle position="n" />
      <ImageCropperHandle position="e" />
      <ImageCropperHandle position="s" />
      <ImageCropperHandle position="w" />
      <ImageCropperHandle position="ne" />
      <ImageCropperHandle position="se" />
      <ImageCropperHandle position="sw" />
      <ImageCropperHandle position="nw" />
    </ArkImageCropper.Selection>
  );
};

export const ImageCropperHandle = (
  props: React.ComponentProps<typeof ArkImageCropper.Handle>,
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkImageCropper.Handle
      className={cn(
        "absolute flex touch-none items-center justify-center",
        "h-[calc(var(--cropper-handler-size)+8px)] w-[calc(var(--cropper-handler-size)+8px)]",
        "data-disabled:hidden",
        "data-[position=ne]:cursor-nesw-resize data-[position=nw]:cursor-nwse-resize",
        "data-[position=se]:cursor-nwse-resize data-[position=sw]:cursor-nesw-resize",
        "data-[position=n]:cursor-ns-resize data-[position=s]:cursor-ns-resize",
        "data-[position=e]:cursor-ew-resize data-[position=w]:cursor-ew-resize",
        "border-(--cropper-accent)",
        "[&>span]:bg-(--cropper-accent) [&>span]:shadow-[0_1px_3px_rgb(0_0_0/0.3)]",
        "data-[position=nw]:hover:**:scale-110 [&[data-position=nw]_*]:size-(--cropper-handler-size) [&[data-position=nw]_*]:border-t-[length:(--cropper-handler-width)] [&[data-position=nw]_*]:border-l-[length:(--cropper-handler-width)] [&[data-position=nw]_*]:bg-(--cropper-accent)",
        "data-[position=ne]:hover:**:scale-110 [&[data-position=ne]_*]:size-(--cropper-handler-size) [&[data-position=ne]_*]:border-t-[length:(--cropper-handler-width)] [&[data-position=ne]_*]:border-r-[length:(--cropper-handler-width)] [&[data-position=ne]_*]:bg-(--cropper-accent)",
        "data-[position=se]:hover:**:scale-110 [&[data-position=se]_*]:size-(--cropper-handler-size) [&[data-position=se]_*]:border-r-[length:(--cropper-handler-width)] [&[data-position=se]_*]:border-b-[length:(--cropper-handler-width)] [&[data-position=se]_*]:bg-(--cropper-accent)",
        "data-[position=sw]:hover:**:scale-110 [&[data-position=sw]_*]:size-(--cropper-handler-size) [&[data-position=sw]_*]:border-b-[length:(--cropper-handler-width)] [&[data-position=sw]_*]:border-l-[length:(--cropper-handler-width)] [&[data-position=sw]_*]:bg-(--cropper-accent)",
        "data-[position=n]:hover:**:opacity-100 [&[data-position=n]_*]:size-1.5 [&[data-position=n]_*]:bg-(--cropper-accent) [&[data-position=n]_*]:opacity-0",
        "data-[position=s]:hover:**:opacity-100 [&[data-position=s]_*]:size-1.5 [&[data-position=s]_*]:bg-(--cropper-accent) [&[data-position=s]_*]:opacity-0",
        "data-[position=e]:hover:**:opacity-100 [&[data-position=e]_*]:size-1.5 [&[data-position=e]_*]:bg-(--cropper-accent) [&[data-position=e]_*]:opacity-0",
        "data-[position=w]:hover:**:opacity-100 [&[data-position=w]_*]:size-1.5 [&[data-position=w]_*]:bg-(--cropper-accent) [&[data-position=w]_*]:opacity-0",
        className,
      )}
      {...rest}
      data-slot={slot ?? "image-cropper-handle"}
    >
      <span aria-hidden className="block size-(--cropper-handler-size)" />
    </ArkImageCropper.Handle>
  );
};

export const ImageCropperGrid = (props: React.ComponentProps<typeof ArkImageCropper.Grid>) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkImageCropper.Grid
      className={cn(
        "absolute",
        "opacity-0",
        "pointer-events-none",
        "transition-opacity duration-200",
        "data-[axis=horizontal]:inset-[33.33%_0] data-[axis=horizontal]:border-white/40 data-[axis=horizontal]:border-t data-[axis=horizontal]:border-b",
        "data-[axis=vertical]:inset-[0_33.33%] data-[axis=vertical]:border-white/40 data-[axis=vertical]:border-r data-[axis=vertical]:border-l",
        "data-dragging:opacity-100",
        "data-panning:opacity-100",
        "motion-reduce:transition-none!",
        className,
      )}
      {...rest}
      data-slot={slot ?? "image-cropper-grid"}
    />
  );
};
