import { Portal } from "@ark-ui/react";
import { Combobox as ArkCombobox } from "@ark-ui/react/combobox";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { SearchIcon } from "lucide-react";
import type React from "react";
import { cn } from "../lib/cn";
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

export const CommandDialog = Dialog;

// `CommandDialog` *is* `Dialog`, so its trigger is `DialogTrigger` — a renamed alias only made
// the two look like different machines.
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

export const CommandInput = (props: CommandInputProps) => {
  const { size = "md", className, ...rest } = props;

  return (
    <ComboboxControl className="mb-2">
      <InputGroup
        className={cn("rounded-xl bg-field", className)}
        size={size}
        {...rest}
      >
        <InputGroupAddon>
          <SearchIcon aria-hidden className="opacity-64" />
        </InputGroupAddon>
        <ArkCombobox.Input asChild data-slot="command-input">
          <InputGroupInput autoFocus />
        </ArkCombobox.Input>
      </InputGroup>
    </ComboboxControl>
  );
};

interface CommandListProps extends React.ComponentProps<typeof ComboboxList> {}

export const CommandList = (props: CommandListProps) => {
  const { className, slot, ...rest } = props;

  return (
    <div className="max-h-72 min-h-0 flex-1">
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
        "rounded-b-[calc(var(--radius-2xl,1rem)-1px)] border-t",
        className
      )}
      {...rest}
      data-slot={slot ?? "command-footer"}
    />
  );
};
