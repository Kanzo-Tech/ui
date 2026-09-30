/**
 * The height of a single-line control, written once.
 *
 * A control's size is one custom property, `--size`, and its height is one utility that reads it.
 * `controlSizes` assigns the property per size token — a multiple of `--size-field`, the knob a
 * tenant turns to ask for tighter controls without asking for tighter text — and `controlHeight`
 * reads it. Every recipe for a control that sits in a form row spreads the first into its `size`
 * variant and puts the second on its `base`, so a text input, a select, a combobox, a date picker
 * and a segment group are the same height at the same token, at every density, by construction.
 *
 * **On the base, not on the size, and not on a `data-slot`**: the reason is on `/docs/design/naming`.
 *
 * A control that grows (a tags input with a second row, a textarea) takes `controlMinHeight`
 * instead; one that lives inside another control's border (an input inside a group) is the group's
 * height less its border, and is written that way in `input-group.tsx`.
 *
 * `control-size.test.ts` fails when a recipe listed there stops using these.
 */
export const controlSizes = {
  sm: "[--size:calc(var(--size-field)*7)]",
  md: "[--size:calc(var(--size-field)*8)]",
  lg: "[--size:calc(var(--size-field)*9)]",
} as const;

export const controlHeight = "h-(--size)";
export const controlMinHeight = "min-h-(--size)";
