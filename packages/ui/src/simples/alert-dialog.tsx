import type React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "./dialog";

export const AlertDialog = (props: React.ComponentProps<typeof Dialog>) => (
  <Dialog role="alertdialog" {...props} />
);

export const AlertDialogTrigger = (
  { slot, ...rest }: React.ComponentProps<typeof DialogTrigger>
) => <DialogTrigger {...rest} slot={slot ?? "alert-dialog-trigger"} />;

export const AlertDialogContent = (
  { slot, ...rest }: React.ComponentProps<typeof DialogContent>
) => (
  <DialogContent
    showCloseButton={false}
    {...rest}
    slot={slot ?? "alert-dialog-content"}
  />
);

export const AlertDialogBody = (
  props: React.ComponentProps<typeof DialogBody>
) => {
  const { className, slot, ...rest } = props;

  return (
    <DialogBody
      className={cn(
        "in-[[data-slot=alert-dialog-content]:has([data-slot=alert-dialog-header])]:pt-0",
        className
      )}
      {...rest}
      slot={slot ?? "alert-dialog-body"}
    />
  );
};

export const AlertDialogHeader = (
  { slot, ...rest }: React.ComponentProps<typeof DialogHeader>
) => <DialogHeader {...rest} slot={slot ?? "alert-dialog-header"} />;

// The title and description are `DialogTitle` / `DialogDescription`: nothing keys off an
// `alert-dialog-title` slot, so renaming them bought two exports and no behaviour.
export const AlertDialogClose = (
  { slot, ...rest }: React.ComponentProps<typeof DialogClose>
) => <DialogClose {...rest} slot={slot ?? "alert-dialog-close"} />;

export const AlertDialogFooter = (
  { slot, ...rest }: React.ComponentProps<typeof DialogFooter>
) => <DialogFooter {...rest} slot={slot ?? "alert-dialog-footer"} />;

interface AlertDialogActionProps
  extends React.ComponentProps<typeof DialogClose>,
    Omit<ButtonProps, "variant"> {
  /**
   * The variant of the action button
   *
   * @default "default"
   */
  variant?: "default" | "destructive";
}

export const AlertDialogAction = (props: AlertDialogActionProps) => {
  const { variant = "default", slot, ...rest } = props;

  return (
    <AlertDialogClose asChild>
      <Button variant={variant} {...rest} slot={slot ?? "alert-dialog-action"} />
    </AlertDialogClose>
  );
};

interface AlertDialogCancelProps
  extends React.ComponentProps<typeof DialogClose>,
    Omit<ButtonProps, "variant"> {}

export const AlertDialogCancel = ({
  slot,
  ...rest
}: AlertDialogCancelProps) => (
  <AlertDialogClose asChild>
    <Button variant="outline" {...rest} slot={slot ?? "alert-dialog-cancel"} />
  </AlertDialogClose>
);
