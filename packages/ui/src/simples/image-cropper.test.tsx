import {
  useImageCropper as useArkImageCropper,
  useImageCropperContext as useArkImageCropperContext,
} from "@ark-ui/react/image-cropper";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ImageCropper,
  ImageCropperImage,
  ImageCropperSelection,
  useImageCropper,
} from "./image-cropper.js";

const cropper = (axis?: "horizontal" | "vertical" | "both") =>
  render(
    <ImageCropper>
      <ImageCropperImage alt="" src="/example/sighting-slips.svg" />
      <ImageCropperSelection axis={axis} />
    </ImageCropper>,
  );

describe("useImageCropper", () => {
  // Shark binds this name to Ark's MACHINE hook and ships no `ImageCropperRootProvider`, so nothing
  // its own file renders can be handed the machine — the export is unreachable there. Every other
  // `useX` in this library is the context hook, which is also the one the Field notes renderer calls
  // to read `getCropData()` from inside the tree. Asserted against Ark directly, because the parity
  // guard compares names and never bindings.
  it("is Ark's context hook, not the machine hook Shark binds", () => {
    expect(useImageCropper).toBe(useArkImageCropperContext);
    expect(useImageCropper).not.toBe(useArkImageCropper);
  });
});

describe("ImageCropper", () => {
  it("renders the viewport, the image and a selection under their own slots", () => {
    const { container } = cropper();

    expect(container.querySelector("[data-slot=image-cropper]")).not.toBeNull();
    expect(container.querySelector("[data-slot=image-cropper-viewport]")).not.toBeNull();
    expect(container.querySelector("[data-slot=image-cropper-image]")).not.toBeNull();
    expect(container.querySelector("[role=slider]")?.getAttribute("data-slot")).toBe(
      "image-cropper-selection",
    );
  });

  it("gives the selection eight handles, and a grid line per axis it is asked for", () => {
    const { container } = cropper();

    expect(container.querySelectorAll("[data-slot=image-cropper-handle]")).toHaveLength(8);
    expect(container.querySelectorAll("[data-slot=image-cropper-grid]")).toHaveLength(2);

    const one = cropper("horizontal");

    expect(one.container.querySelectorAll("[data-slot=image-cropper-grid]")).toHaveLength(1);
  });

  /**
   * Three of the reference's classes name no utility Tailwind can compile, so they emit nothing and
   * no build says so. The vertical one is the visible half: `inset-0_[33.33%]` opens its bracket a
   * token late, leaving an absolutely-positioned grid line with no inset, which collapses onto the
   * selection's inline start instead of drawing thirds. Pinned as text because a class that emits
   * nothing renders identically to one that was never written.
   */
  it("spells the three classes the reference file gets wrong", () => {
    const { container } = cropper();

    const grid = container.querySelector("[data-slot=image-cropper-grid][data-axis=vertical]");
    const selection = container.querySelector("[data-slot=image-cropper-selection]");

    expect(grid?.className).toContain("data-[axis=vertical]:inset-[0_33.33%]");
    expect(selection?.className).toContain("backface-hidden");
    expect(selection?.className).not.toContain("backface-visibility-hidden");
    expect(
      container.querySelector("[data-slot=image-cropper-handle][data-position=n]")?.className,
    ).toContain("[&[data-position=n]_*]:bg-(--cropper-accent)");
  });
});
