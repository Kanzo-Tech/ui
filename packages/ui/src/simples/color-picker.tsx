"use client";

import {
  ColorPicker as ArkColorPicker,
  type ColorPickerValueChangeDetails,
  type Color,
  parseColor as parseColorArk,
  useColorPickerContext,
} from "@ark-ui/react/color-picker";
import { ark } from "@ark-ui/react/factory";
import { Portal } from "@ark-ui/react/portal";
import { CheckIcon, Pipette } from "lucide-react";
import React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { FieldLabel } from "./field";

export const parseColor = parseColorArk;
export const useColorPicker = useColorPickerContext;

/**
 * `parseColor` that returns `undefined` instead of throwing on a blank or unparseable string.
 */
export const safeParseColor = (value?: string): Color | undefined => {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return parseColorArk(value);
  } catch {
    return undefined;
  }
};

export interface ColorPickerChangeDetails
  extends ColorPickerValueChangeDetails {
  /**
   * The value as a hex string. The machine's `format` is `"rgba" | "hsla" | "hsba"` — there is
   * no `"hex"` member — so `valueAsString` is never hex, which is the one format most consumers
   * actually store.
   */
  valueAsHex: string;
}

export interface ColorPickerProps
  extends Omit<
    React.ComponentProps<typeof ArkColorPicker.Root>,
    "defaultValue" | "onValueChange" | "value"
  > {
  /**
   * The default value of the color picker. A blank or unparseable string is treated as "no
   * value" rather than throwing.
   */
  defaultValue?: string;
  /**
   * The value of the color picker. A blank or unparseable string is treated as "no value"
   * rather than throwing.
   */
  value?: string;
  /**
   * Called when the value changes, with `valueAsHex` added to Ark's details.
   */
  onValueChange?: (details: ColorPickerChangeDetails) => void;
}

// Divergence from Shark (whose ColorPicker this file otherwise matches part for part) on two
// points, both inherited defects rather than deliberate design:
//
//  1. Shark calls `parseColor(value)` on every render, and Ark's `parseColor` THROWS on `""` or
//     on any half-typed string. That makes an optional colour field impossible and crashes any
//     form that binds `value` to raw user input. We parse defensively; an unparseable string
//     leaves the machine on its own last value instead of blowing up.
//  2. Shark only forwards `onValueChange` when the picker is controlled, so an uncontrolled
//     `<ColorPicker defaultValue onValueChange>` silently never fires. We always forward, and
//     drop the mirror state that existed only to feed `defaultValue` back to a machine that
//     reads it once.
//
// Ark's `useColorPicker` already bridges `useFieldContext`, so `<Field invalid>` reaches this
// control with no help from us — unlike RadioGroup and Slider.
export const ColorPicker = (props: ColorPickerProps) => {
  const {
    value,
    defaultValue,
    positioning = {
      placement: "top-start",
    },
    lazyMount = true,
    unmountOnExit = true,
    onValueChange,
    className,
    children,
    ...rest
  } = props;

  const parsedValue = React.useMemo(() => safeParseColor(value), [value]);

  const parsedDefaultValue = React.useMemo(
    () => safeParseColor(defaultValue),
    [defaultValue]
  );

  const handleValueChange = (details: ColorPickerValueChangeDetails) => {
    onValueChange?.({ ...details, valueAsHex: details.value.toString("hex") });
  };

  return (
    <ArkColorPicker.Root
      className={cn("group/color-picker", "w-fit", "flex gap-2", className)}
      data-slot="color-picker"
      defaultValue={parsedDefaultValue}
      lazyMount={lazyMount}
      onValueChange={handleValueChange}
      positioning={positioning}
      unmountOnExit={unmountOnExit}
      value={parsedValue}
      {...rest}
    >
      {children}

      <ArkColorPicker.HiddenInput />
    </ArkColorPicker.Root>
  );
};

export const ColorPickerLabel = (
  props: React.ComponentProps<typeof ArkColorPicker.Label>
) => {
  const { children, ...rest } = props;

  return (
    <FieldLabel asChild>
      <ArkColorPicker.Label data-slot="color-picker-label" {...rest}>
        {children}
      </ArkColorPicker.Label>
    </FieldLabel>
  );
};

export const ColorPickerControl = (
  props: React.ComponentProps<typeof ArkColorPicker.Control>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.Control
      className={cn("flex flex-row items-center gap-2", className)}
      data-slot="color-picker-control"
      {...rest}
    />
  );
};

export const ColorPickerTrigger = (
  props: React.ComponentProps<typeof ArkColorPicker.Trigger>
) => <ArkColorPicker.Trigger data-slot="color-picker-trigger" {...props} />;

export const ColorPickerTransparencyGrid = (
  props: React.ComponentProps<typeof ArkColorPicker.TransparencyGrid>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.TransparencyGrid
      className={cn(
        "size-full rounded-[calc(var(--radius-sm)-0.5px)]",
        "bg-[linear-gradient(45deg,#e4e4e4_25%,transparent_25%),linear-gradient(-45deg,#e4e4e4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e4_75%),linear-gradient(-45deg,transparent_75%,#e4e4e4_75%)]",
        "bg-position-[0_0,0_4px,4px_-4px,-4px_0] bg-size-(--spacing(2))",
        className
      )}
      {...rest}
    />
  );
};

export const ColorPickerContent = (
  props: React.ComponentProps<typeof ArkColorPicker.Content>
) => {
  const { className, ...rest } = props;

  return (
    <Portal>
      <ArkColorPicker.Positioner data-slot="color-picker-positioner">
        <ArkColorPicker.Content
          className={cn(
            "[--space:--spacing(3)]",
            "z-50",
            "relative",
            "w-full min-w-56",
            "flex flex-col gap-4",
            "p-(--space)",
            "bg-popover",
            "rounded-xl border shadow-lg/5",
            "outline-none",
            "origin-(--transform-origin)",
            "data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[98%] data-[state=open]:animate-in",
            "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[98%] data-[state=closed]:animate-out",
            "motion-reduce:animate-none!",
            className
          )}
          data-slot="color-picker-content"
          {...rest}
        />
      </ArkColorPicker.Positioner>
    </Portal>
  );
};

export const ColorPickerView = (
  props: React.ComponentProps<typeof ArkColorPicker.View>
) => {
  const { className, ...rest } = props;
  return (
    <ArkColorPicker.View
      className={cn("relative flex size-full flex-1 flex-col gap-4", className)}
      data-slot="color-picker-view"
      {...rest}
    />
  );
};

export const ColorPickerSlider = (
  props: React.ComponentProps<typeof ArkColorPicker.ChannelSlider>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkColorPicker.ChannelSlider
      className={cn(
        "relative",
        "flex items-center",
        "touch-none select-none",
        "rounded-full border",
        "data-[orientation=horizontal]:w-full",
        "data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        "group-data-disabled/color-picker:pointer-events-none group-data-disabled/color-picker:cursor-not-allowed group-data-disabled/color-picker:opacity-64",
        className
      )}
      data-slot="color-picker-channel-slider"
      {...rest}
    >
      {children}

      <ArkColorPicker.ChannelSliderTrack
        className={cn(
          "grow",
          "rounded-full",
          "select-none overflow-hidden",
          "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full",
          "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2"
        )}
        data-slot="color-picker-channel-slider-track"
      />
      <ArkColorPicker.ChannelSliderThumb
        className={cn(
          "relative shrink-0",
          "size-4.5",
          "-translate-1/2",
          "rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(0,0,0,0.1)]",
          "outline-none ring-1 ring-border/64",
          "origin-left data-[orientation=vertical]:origin-bottom"
        )}
        data-slot="color-picker-channel-slider-thumb"
      />
    </ArkColorPicker.ChannelSlider>
  );
};

interface ColorPickerEyeDropperTrigger
  extends React.ComponentProps<typeof ArkColorPicker.EyeDropperTrigger>,
    ButtonProps {}

export const ColorPickerEyeDropperTrigger = (
  props: ColorPickerEyeDropperTrigger
) => {
  const { variant = "outline", size = "icon-md", children, ...rest } = props;

  return (
    <ArkColorPicker.EyeDropperTrigger
      data-slot="color-picker-eye-dropper"
      {...rest}
      asChild
    >
      <Button size={size} variant={variant}>
        {children || <Pipette />}
      </Button>
    </ArkColorPicker.EyeDropperTrigger>
  );
};

export const ColorPickerSwatchGroup = (
  props: React.ComponentProps<typeof ArkColorPicker.SwatchGroup>
) => {
  const { className, ...rest } = props;
  return (
    <ArkColorPicker.SwatchGroup
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-slot="color-picker-swatch-group"
      {...rest}
    />
  );
};

export const ColorPickerSwatchTrigger = (
  props: React.ComponentProps<typeof ArkColorPicker.SwatchTrigger>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.SwatchTrigger
      className={cn(
        "relative",
        "size-8",
        "flex items-center justify-center",
        "rounded-full",
        "transition-[border-color,box-shadow] duration-100 ease-out will-change-transform",
        "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "data-[state=checked]:shadow-sm/5 data-[state=checked]:ring-(--color) data-[state=checked]:ring-2",
        "motion-reduce:transition-none!",
        className
      )}
      data-slot="color-picker-swatch-trigger"
      {...rest}
    />
  );
};

export const ColorPickerSwatch = (
  props: React.ComponentProps<typeof ArkColorPicker.Swatch>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.Swatch
      className={cn(
        "size-full",
        "shrink-0",
        "overflow-hidden",
        "rounded-[inherit]",
        "transition-transform duration-100 ease-out will-change-transform",
        "not-[data-state=checked]:hover:scale-110",
        "data-[state=checked]:scale-[0.8]",
        "motion-reduce:transition-none!",
        className
      )}
      data-slot="color-picker-swatch"
      {...rest}
    />
  );
};

export const ColorPickerSwatchIndicator = (
  props: React.ComponentProps<typeof ArkColorPicker.SwatchIndicator>
) => {
  const { className, children, ...rest } = props;

  return (
    <ArkColorPicker.SwatchIndicator
      className={cn(
        "absolute inset-0 z-10",
        "flex items-center justify-center",
        // Deliberately raw, not a token: this check sits on a swatch whose colour the USER
        // picked, so no design token can describe what contrasts with it.
        "text-white",
        "pointer-events-none",
        "zoom-in-5 animate-in blur-in-md",
        "[&_svg]:size-1/2",
        "motion-reduce:animate-none!",
        className
      )}
      data-slot="color-picker-swatch-indicator"
      {...rest}
    >
      {children || <CheckIcon />}
    </ArkColorPicker.SwatchIndicator>
  );
};

export const ColorPickerValue = (
  props: React.ComponentProps<typeof ArkColorPicker.ValueText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.ValueText
      className={cn("font-medium text-sm", className)}
      data-slot="color-picker-value"
      {...rest}
    />
  );
};

export const ColorPickerValueSwatch = (
  props: React.ComponentProps<typeof ArkColorPicker.ValueSwatch>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.ValueSwatch
      className={cn(
        "relative size-8 shrink-0",
        "overflow-hidden",
        "rounded-full border",
        className
      )}
      data-slot="color-picker-value-swatch"
      {...rest}
    />
  );
};

interface ColorPickerAreaProps
  extends React.ComponentProps<typeof ArkColorPicker.Area> {
  /**
   *
   */
  showDots?: boolean;
}

export const ColorPickerArea = (props: ColorPickerAreaProps) => {
  const { className, showDots = false, children, ...rest } = props;

  return (
    <ArkColorPicker.Area
      className={cn(
        "relative",
        "aspect-square size-full",
        "rounded-xl border",
        "touch-none",
        {
          "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[radial-gradient(circle,#fff3_1px,#0000_1px)] after:bg-size-[8px_8px]":
            showDots,
        },
        className
      )}
      data-slot="color-picker-area"
      {...rest}
    >
      <ArkColorPicker.AreaBackground
        className="size-full rounded-[inherit]"
        data-slot="color-picker-area-background"
      />

      {children}
    </ArkColorPicker.Area>
  );
};

export const ColorPickerAreaThumb = (
  props: React.ComponentProps<typeof ArkColorPicker.AreaThumb>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.AreaThumb
      className={cn(
        "size-4.5",
        "rounded-full border-[3px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(0,0,0,0.1)]",
        "outline-none ring-border/64",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        className
      )}
      data-slot="color-picker-area-thumb"
      {...rest}
    />
  );
};

export const ColorPickerInput = (
  props: Partial<React.ComponentProps<typeof ArkColorPicker.ChannelInput>>
) => {
  const { channel = "hex", ...rest } = props;

  return (
    <ArkColorPicker.ChannelInput
      channel={channel}
      data-slot="color-picker-input"
      {...rest}
    />
  );
};

// Ark ships FormatTrigger/FormatSelect and Shark exposes neither, which is why every hex-shaped
// call site is stuck on whichever format the initial colour happened to parse as. Exposed here so
// the format is switchable at runtime; the machine's set is `rgba | hsla | hsba`.
interface ColorPickerFormatTriggerProps
  extends React.ComponentProps<typeof ArkColorPicker.FormatTrigger>,
    ButtonProps {}

export const ColorPickerFormatTrigger = (
  props: ColorPickerFormatTriggerProps
) => {
  const { variant = "ghost", size = "sm", children, ...rest } = props;

  return (
    <ArkColorPicker.FormatTrigger
      data-slot="color-picker-format-trigger"
      {...rest}
      asChild
    >
      <Button size={size} variant={variant}>
        {children}
      </Button>
    </ArkColorPicker.FormatTrigger>
  );
};

export const ColorPickerFormatSelect = (
  props: React.ComponentProps<typeof ArkColorPicker.FormatSelect>
) => {
  const { className, ...rest } = props;

  return (
    <ArkColorPicker.FormatSelect
      className={cn(
        "appearance-none",
        "h-7 min-w-0 ps-2 pe-2",
        "select-none text-sm",
        "bg-transparent dark:bg-input/30",
        "rounded-lg border border-input shadow-xs/5",
        "transition-colors",
        "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/32",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-64",
        "motion-reduce:transition-none!",
        className
      )}
      data-slot="color-picker-format-select"
      {...rest}
    />
  );
};

export const ColorPickerSwatchPreview = (
  props: React.ComponentProps<typeof ark.div>
) => {
  const { className, ...rest } = props;

  return (
    <ark.div
      className={cn(
        "relative",
        "size-8",
        "shrink-0",
        "rounded-full border",
        "pointer-events-none overflow-hidden",
        "group-data-[size=lg]/input-group:size-5",
        "group-data-[size=md]/input-group:size-4",
        "group-data-[size=sm]/input-group:size-3.5",
        "group-data-disabled/color-input:opacity-64",
        className
      )}
      data-slot="color-picker-input-swatch"
      {...rest}
    >
      <ArkColorPicker.TransparencyGrid
        className={cn(
          "size-full rounded-[calc(var(--radius-sm)-0.5px)]",
          "bg-[linear-gradient(45deg,#e4e4e4_25%,transparent_25%),linear-gradient(-45deg,#e4e4e4_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e4e4e4_75%),linear-gradient(-45deg,transparent_75%,#e4e4e4_75%)]",
          "bg-position-[0_0,0_4px,4px_-4px,-4px_0] bg-size-(--spacing(2))"
        )}
      />
      <ArkColorPicker.ValueSwatch className="z-1 size-full" />
    </ark.div>
  );
};
