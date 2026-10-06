"use client";

import { Portal } from "@ark-ui/react";
import { Combobox as ArkCombobox } from "@ark-ui/react/combobox";
import { Dialog as ArkDialog, useDialogContext } from "@ark-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
import { type Hotkey, useHotkey } from "../lib/use-hotkey";
import {
  Combobox,
  ComboboxControl,
  ComboboxEmpty,
  ComboboxGroup,
  type ComboboxItem,
  ComboboxList,
  comboboxItemVariants,
} from "./combobox";
import {
  Dialog,
  type DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPositioner,
  dialogContentVariants,
} from "./dialog";
import type { InputProps } from "./input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "./input-group";
import { MenuShortcut } from "./menu";
import { Separator } from "./separator";

export interface CommandDialogProps extends React.ComponentProps<typeof Dialog> {
  /**
   * The key that opens and closes the palette — `"mod+k"` for ⌘K / Ctrl+K, the palette's own
   * convention. **Opt-in — there is no default**: a design system claims a key in its host's keymap
   * only when asked. A key pressed while typing in a field is the field's.
   */
  hotkey?: Hotkey;
}

/** Toggles the dialog it sits in through Ark's own machine, so a controlled `open` hears `onOpenChange`. */
const DialogHotkey = ({ hotkey }: { hotkey: Hotkey }) => {
  const dialog = useDialogContext();
  useHotkey(hotkey, () => dialog.setOpen(!dialog.open));
  return null;
};

/**
 * `Dialog`, and the one thing a palette adds to it: the key that summons it. Shark's site writes that
 * listener beside every palette it mounts (`header.command.tsx`); here it is the dialog's, so the next
 * palette does not write it again. Its trigger is still `DialogTrigger` — it is the same machine.
 */
export const CommandDialog = ({ hotkey, children, ...props }: CommandDialogProps) => (
  <Dialog {...props}>
    {hotkey ? <DialogHotkey hotkey={hotkey} /> : null}
    {children}
  </Dialog>
);
interface CommandDialogContentProps
  extends React.ComponentProps<typeof DialogContent> {
  /**
   * The description of the dialog
   *
   * @default "Search for a command to run..."
   */
  description?: string;
  /**
   * The title of the dialog
   *
   * @default "Command Palette"
   */
  title?: string;
}

export const CommandDialogContent = (props: CommandDialogContentProps) => {
  const {
    size = "lg",
    title = "Command Palette",
    description = "Search for a command to run...",
    className,
    children,
    slot,
    ...rest
  } = props;

  return (
    <Portal>
      <DialogOverlay />

      <DialogPositioner>
        <ArkDialog.Content
          className={cn(
            "max-sm:row-start-1",
            dialogContentVariants({ size }),
            "border-0 p-0",
            className
          )}
          {...rest}
          data-slot={slot ?? "command-dialog-content"}
        >
          <DialogHeader
            className="sr-only"
            description={description}
            title={title}
          />

          {children}
        </ArkDialog.Content>
      </DialogPositioner>
    </Portal>
  );
};

export const Command: ArkCombobox.RootComponent = (props) => {
  const { lazyMount = true, unmountOnExit = true, className, ...rest } = props;

  return (
    <Combobox
      className={cn(
        "isolate",
        "flex min-h-0 flex-1 flex-col",
        "p-2",
        "bg-popover",
        "text-popover-foreground",
        "rounded-2xl border",
        className
      )}
      closeOnSelect={false}
      disableLayer
      inputBehavior="autohighlight"
      lazyMount={lazyMount}
      loopFocus={false}
      open
      selectionBehavior="clear"
      unmountOnExit={unmountOnExit}
      {...rest}
    />
  );
};

interface CommandInputProps
  extends Omit<React.ComponentProps<typeof ArkCombobox.Input>, "size"> {
  /**
   * The size of the input
   *
   * @default "md"
   */
  size?: InputProps["size"];
}

export const CommandContent = (
  props: React.ComponentProps<typeof ArkCombobox.Content>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCombobox.Content
      className={cn(
        "flex flex-1 flex-col",
        "max-h-(--available-height) min-h-0",
        "-me-2",
        "outline-none",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-foreground/20 overflow-auto overscroll-contain",
        "[:not(.has-[+[data-slot=command-footer]])]:rounded-b-2xl [:not(.has-[+[data-slot=command-footer]])]:border-b",
        className
      )}
      {...rest}
      data-slot={slot ?? "command-content"}
    />
  );
};

// The input's own props reach the input — `placeholder`, `aria-invalid`, `autoFocus` — and
// `className` and `size` style the group around it. `autoFocus` defaults on for the dialog, where
// opening the palette is asking to type; a palette inline in a panel turns it off.
//
// `children` are drawn in the group before the input: the chips of a palette that filters, composed
// as Shark's `tags-input/example-combobox` composes them — `TagsInputRootProvider` around the palette
// and `TagsInputItem`s here, the input belonging to both machines.
export const CommandInput = (props: CommandInputProps) => {
  const { size = "md", className, autoFocus = true, children, ...rest } = props;

  return (
    <ComboboxControl className="mb-2">
      <InputGroup className={cn("rounded-xl bg-field", className)} size={size}>
        <InputGroupAddon>
          <SearchIcon aria-hidden className="opacity-64" />
        </InputGroupAddon>
        {children}
        <ArkCombobox.Input asChild>
          <InputGroupInput autoFocus={autoFocus} {...rest} slot="command-input" />
        </ArkCombobox.Input>
      </InputGroup>
    </ComboboxControl>
  );
};

interface CommandListProps extends React.ComponentProps<typeof ComboboxList> {}

export const CommandList = (props: CommandListProps) => {
  const { className, slot, ...rest } = props;

  return (
    // Inline, the list caps itself so a panel keeps its height; in the dialog the content is the
    // height, and the list fills it.
    <div className="max-h-72 min-h-0 flex-1 in-data-[slot=command-dialog-content]:max-h-none">
      <ComboboxList
        className={cn("flex-1 pe-2.5", className)}
        {...rest}
        slot={slot ?? "command-list"}
      />
    </div>
  );
};

export const CommandEmpty = (
  props: React.ComponentProps<typeof ComboboxEmpty>
) => {
  const { className, children, slot, ...rest } = props;

  return (
    <ComboboxEmpty
      className={cn("py-6 text-center text-sm", className)}
      {...rest}
      slot={slot ?? "command-empty"}
    >
      {children || "No results found."}
    </ComboboxEmpty>
  );
};

// A group's label comes from `heading`, which `ComboboxGroup` renders itself — so the renamed
// `CommandGroupLabel` was redundant twice over and is gone.
export const CommandGroup = (
  { slot, ...rest }: React.ComponentProps<typeof ComboboxGroup>
) => <ComboboxGroup {...rest} slot={slot ?? "command-group"} />;

export const CommandItem = (
  props: React.ComponentProps<typeof ComboboxItem>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkCombobox.Item
      className={cn(comboboxItemVariants({ showIndicator: false }), className)}
      persistFocus
      {...rest}
      data-slot={slot ?? "command-item"}
    />
  );
};

export const CommandSeparator = (props: React.ComponentProps<"div">) => {
  const { className, slot, ...rest } = props;

  return (
    <Separator
      className={cn("my-2", className)}
      {...rest}
      slot={slot ?? "command-separator"}
    />
  );
};

export const CommandShortcut = (
  { slot, ...rest }: React.ComponentProps<typeof MenuShortcut>
) => <MenuShortcut {...rest} slot={slot ?? "command-shortcut"} />;

export const CommandFooter = (props: React.ComponentProps<"div">) => {
  const { className, slot, ...rest } = props;

  return (
    <div
      className={cn(
        "z-10",
        "flex items-center justify-between gap-2",
        "-m-2 mt-2 px-4 py-3",
        "text-muted-foreground text-xs",
        "rounded-b-[calc(var(--radius-2xl)-1px)] border-t",
        className
      )}
      {...rest}
      data-slot={slot ?? "command-footer"}
    />
  );
};
