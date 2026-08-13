import {
  Listbox as ArkListbox,
  useListboxContext,
} from "@ark-ui/react/listbox";
import { CheckIcon } from "lucide-react";
import type React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "../lib/cn";
import { inputVariants } from "./input";
import { MenuShortcut } from "./menu";

export const useListbox = useListboxContext;

export const Listbox: ArkListbox.RootComponent = (props) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.Root
      className={cn(
        "w-full",
        "flex flex-col gap-1.5",
        "text-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox"}
    />
  );
};

// Not in Shark's file, but it is an Ark part (`Listbox.Label`) and the only way a
// standalone listbox — one with no trigger to borrow a name from — gets an accessible
// name: Ark points the content's `aria-labelledby` at it.
export const ListboxLabel = (
  props: React.ComponentProps<typeof ArkListbox.Label>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.Label
      className={cn(
        "select-none font-medium text-sm leading-snug",
        "data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-label"}
    />
  );
};

export const ListboxValueText = (
  props: React.ComponentProps<typeof ArkListbox.ValueText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.ValueText
      className={cn("font-normal", className)}
      {...rest}
      data-slot={slot ?? "listbox-value-text"}
    />
  );
};

interface ListboxInputProps
  extends Omit<React.ComponentProps<typeof ArkListbox.Input>, "size">,
    VariantProps<typeof inputVariants> {}

// Not in Shark's file, but it is an Ark part (`Listbox.Input`) and the only way a long list
// grows a filter field without a second machine: nesting a `Combobox` inside the surface a
// `Listbox` already lives in gives two machines one open-state and one positioner to fight
// over. Styled from `inputVariants`, so a searchable listbox and a `Combobox` are the same
// box.
//
// **The machine holds no input value and filters nothing.** There is no `inputValue` in
// `@zag-js/listbox` and no `onInputValueChange`; `getInputProps` returns an uncontrolled
// `<input>` whose whole job is ARIA (`aria-controls`, `aria-activedescendant`,
// `aria-autocomplete="list"`) plus forwarding keys to the content — ArrowUp/ArrowDown always,
// Home/End and ArrowLeft/ArrowRight only under `keyboardPriority="navigate"`, and Enter as a
// click on the highlighted item. Narrowing the collection is entirely the caller's, exactly as
// it is in `Combobox`, and rather more so.
export const ListboxInput = (props: ListboxInputProps) => {
  const { size = "md", type = "text", className, slot, ...rest } = props;

  return (
    <ArkListbox.Input
      className={cn(inputVariants({ size }), className)}
      data-size={size}
      type={type}
      {...rest}
      data-slot={slot ?? "listbox-input"}
    />
  );
};

// No portal, no positioner, no trigger: this is the inline list. It is placed by whoever
// renders it — inside a `PopoverContent`, or straight into a panel — which is what lets one
// component serve both. Height and scrolling belong to that caller too, so the base only
// declares flow.
export const ListboxContent = (
  props: React.ComponentProps<typeof ArkListbox.Content>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.Content
      className={cn(
        "w-full",
        "flex flex-col gap-1",
        "outline-hidden",
        "overflow-hidden",
        "data-[orientation=horizontal]:max-h-none data-[orientation=horizontal]:flex-row",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-content"}
    />
  );
};

// Divergence from Shark, declared: Shark's listbox item is its own look — `px-2.5 py-2`,
// `rounded-xl`, a checked background, `hover:` classes, a `text-primary` check. Ours is
// `SelectItem`'s geometry instead, because the first consumer renders this listbox inside a
// Popover alongside Selects, and two lists of options that sit a few pixels apart must not
// disagree about row height, indent or where the check lives. Four concrete changes:
//
//  1. Geometry copied from `SelectItem`: `py-1.5 ps-2`, `rounded-lg`, `cursor-default`,
//     `size-4` icons, and the same group-label indent rule.
//  2. The end padding that reserves room for the check is conditional
//     (`has-[…listbox-item-indicator]:pe-8`) — Shark's anatomy makes the indicator an
//     optional child, so an item without one must not carry a dead 8-unit gutter. Ark marks
//     an unselected indicator `hidden` rather than unmounting it, and `:has()` still matches
//     a hidden element, so the padding does not flicker with selection.
//  3. Hover is `highlightOnHover`, not a `hover:` class. Ark's select moves the *highlight*
//     on pointer move, so exactly one row ever reads as active; a CSS `hover:` rule paints a
//     second one whenever the pointer and the keyboard disagree. Pass
//     `highlightOnHover={false}` in `selectionMode="extended"`, where the highlight doubles
//     as the shift-click anchor.
//  4. No `data-[state=checked]` background — the check mark is the selected affordance here,
//     as it is in Select.
//
// The `destructive` variant is Shark's, kept as-is: Select has no equivalent to match, and
// the variant costs the default appearance nothing.
const listboxItemVariants = tv({
  base: [
    "group/listbox-item",
    "relative",
    "w-full",
    "py-1.5 ps-2 pe-2",
    "has-[[data-slot=listbox-item-indicator]]:pe-8",
    "flex items-center gap-2",
    "select-none text-base md:text-sm",
    "rounded-lg",
    "cursor-default",
    "outline-hidden",
    "in-[[data-slot=listbox-content]:has([data-slot=listbox-item-group-label])]:ps-4",
    "data-disabled:pointer-events-none data-disabled:opacity-64",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground",
  ],
  variants: {
    variant: {
      default: [
        "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
      ],
      destructive: [
        "text-destructive dark:text-destructive-foreground",
        "data-highlighted:bg-destructive-a4",
        "**:[svg]:text-destructive! dark:**:[svg]:text-destructive-foreground!",
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

interface ListboxItemProps
  extends React.ComponentProps<typeof ArkListbox.Item>,
    VariantProps<typeof listboxItemVariants> {}

export const ListboxItem = (props: ListboxItemProps) => {
  const {
    variant = "default",
    highlightOnHover = true,
    className,
    slot,
    ...rest
  } = props;

  return (
    <ArkListbox.Item
      className={cn(listboxItemVariants({ variant }), className)}
      data-variant={variant}
      highlightOnHover={highlightOnHover}
      {...rest}
      data-slot={slot ?? "listbox-item"}
    />
  );
};

export const ListboxItemText = (
  props: React.ComponentProps<typeof ArkListbox.ItemText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.ItemText
      className={cn(
        "min-w-0",
        "flex-1",
        "text-ellipsis whitespace-nowrap",
        "overflow-hidden",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-item-text"}
    />
  );
};

// Absolutely placed at the item's end edge, over the gutter `pe-8` reserves — the same
// position `SelectItem` puts its check in, so the two lists line up.
export const ListboxItemIndicator = (
  props: React.ComponentProps<typeof ArkListbox.ItemIndicator>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ArkListbox.ItemIndicator
      className={cn(
        "absolute inset-e-2",
        "flex size-4 shrink-0 items-center justify-center",
        "zoom-in-95 fade-in-0 animate-in",
        "motion-reduce:animate-none!",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-item-indicator"}
    >
      {children ?? <CheckIcon />}
    </ArkListbox.ItemIndicator>
  );
};

interface ListboxItemGroupProps
  extends React.ComponentProps<typeof ArkListbox.ItemGroup> {
  /**
   * The heading of the listbox item group.
   */
  heading?: string;
}

export const ListboxItemGroup = (props: ListboxItemGroupProps) => {
  const { heading, className, children, slot, ...rest } = props;

  return (
    <ArkListbox.ItemGroup
      className={cn("flex flex-col gap-1", className)}
      {...rest}
      data-slot={slot ?? "listbox-item-group"}
    >
      {!!heading && <ListboxItemGroupLabel>{heading}</ListboxItemGroupLabel>}

      {children}
    </ArkListbox.ItemGroup>
  );
};

// Typography from `SelectGroupLabel`, not Shark's `px-2.5 py-2` — the item above already
// borrows Select's rhythm, and a heading a size larger than the rows it heads is the one
// place the two lists would still read as different components.
export const ListboxItemGroupLabel = (
  props: React.ComponentProps<typeof ArkListbox.ItemGroupLabel>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.ItemGroupLabel
      className={cn(
        "px-2 py-1.5",
        "font-semibold text-muted-foreground text-xs",
        "pointer-events-none",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-item-group-label"}
    />
  );
};

export const ListboxEmpty = (
  props: React.ComponentProps<typeof ArkListbox.Empty>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkListbox.Empty
      className={cn(
        "px-2 py-1.5",
        "text-center text-muted-foreground text-sm",
        className
      )}
      {...rest}
      data-slot={slot ?? "listbox-empty"}
    />
  );
};

// The third rename of `MenuShortcut`'s span, beside `CommandShortcut`. It had no renderer here and
// was withheld for it; the reference ships it, and a house principle withholds no name the
// reference ships — `decisions/a-house-principle-withholds-no-name.md`. The rename is `slot` and
// not a literal `data-slot`, which is the one thing we do not copy from Shark's version of it:
// `decisions/a-primitive-owns-its-slot.md`.
export const ListboxShortcut = (
  { slot, ...rest }: React.ComponentProps<typeof MenuShortcut>
) => <MenuShortcut {...rest} slot={slot ?? "listbox-shortcut"} />;
