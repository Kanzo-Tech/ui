import {
  FileUpload as ArkFileUpload,
  useFileUploadContext,
} from "@ark-ui/react/file-upload";
import type React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { FieldLabel } from "./field";

export const useFileUpload = useFileUploadContext;

export const FileUpload = (
  props: React.ComponentProps<typeof ArkFileUpload.Root>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.Root
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload"}
    />
  );
};

export const FileUploadRootProvider = (
  props: React.ComponentProps<typeof ArkFileUpload.RootProvider>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.RootProvider
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload-root-provider"}
    />
  );
};

export const FileUploadLabel = (
  { slot, ...rest }: React.ComponentProps<typeof ArkFileUpload.Label>
) => (
  <FieldLabel asChild>
    <ArkFileUpload.Label {...rest} data-slot={slot ?? "file-upload-label"} />
  </FieldLabel>
);

export const FileUploadDropzone = (
  props: React.ComponentProps<typeof ArkFileUpload.Dropzone>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.Dropzone
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        "px-6 py-8 text-center",
        "cursor-pointer",
        "rounded-lg border border-input border-dashed shadow-xs/5",
        "bg-transparent dark:bg-field",
        "text-muted-foreground text-sm",
        "transition-[color,box-shadow,border-color,background-color]",
        "hover:border-ring hover:bg-accent hover:text-accent-foreground",
        "outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring",
        "data-dragging:border-primary data-dragging:bg-accent data-dragging:text-accent-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-64",
        "data-invalid:border-destructive data-invalid:text-destructive data-invalid:ring-[3px] data-invalid:ring-destructive/24",
        "dark:data-invalid:border-destructive-foreground dark:data-invalid:text-destructive-foreground dark:data-invalid:ring-destructive-foreground/40",
        "motion-reduce:transition-none!",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload-dropzone"}
    />
  );
};

export const FileUploadTrigger = (
  props: React.ComponentProps<typeof ArkFileUpload.Trigger> &
    Pick<ButtonProps, "variant" | "size">
) => {
  const { children, variant = "outline", size, ...rest } = props;

  return (
    <ArkFileUpload.Trigger asChild data-slot="file-upload-trigger">
      <Button size={size} variant={variant} {...rest}>
        {children}
      </Button>
    </ArkFileUpload.Trigger>
  );
};

export const FileUploadItemGroup = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemGroup>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.ItemGroup
      className={cn("flex w-full flex-col gap-2", className)}
      {...rest}
      data-slot={slot ?? "file-upload-item-group"}
    />
  );
};

export const FileUploadItem = (
  props: React.ComponentProps<typeof ArkFileUpload.Item>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.Item
      className={cn(
        "flex items-center gap-3",
        "px-3 py-2 text-sm",
        "rounded-lg border border-input shadow-xs/5",
        "bg-transparent dark:bg-field",
        "data-disabled:opacity-64",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload-item"}
    />
  );
};

export const FileUploadItemPreview = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemPreview>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.ItemPreview
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden",
        "rounded-md border border-input",
        "bg-muted text-muted-foreground",
        "[&_svg:not([class*='size-'])]:size-4",
        "[&_img]:size-full [&_img]:object-cover",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload-item-preview"}
    />
  );
};

export const FileUploadItemPreviewImage = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemPreviewImage>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.ItemPreviewImage
      className={cn("size-full object-cover", className)}
      {...rest}
      data-slot={slot ?? "file-upload-item-preview-image"}
    />
  );
};

export const FileUploadItemName = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemName>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.ItemName
      className={cn(
        "min-w-0 truncate font-medium text-foreground text-sm",
        className
      )}
      {...rest}
      data-slot={slot ?? "file-upload-item-name"}
    />
  );
};

export const FileUploadItemSizeText = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemSizeText>
) => {
  const { className, slot, ...rest } = props;

  return (
    <ArkFileUpload.ItemSizeText
      className={cn("text-muted-foreground text-xs", className)}
      {...rest}
      data-slot={slot ?? "file-upload-item-size-text"}
    />
  );
};

export const FileUploadItemDeleteTrigger = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemDeleteTrigger>
) => {
  const { children, ...rest } = props;

  return (
    <ArkFileUpload.ItemDeleteTrigger
      asChild
      data-slot="file-upload-item-delete-trigger"
    >
      <Button className="ms-auto" size="icon-sm" variant="ghost" {...rest}>
        {children}
      </Button>
    </ArkFileUpload.ItemDeleteTrigger>
  );
};

export const FileUploadClearTrigger = (
  props: React.ComponentProps<typeof ArkFileUpload.ClearTrigger> &
    Pick<ButtonProps, "variant" | "size">
) => {
  const { children, variant = "ghost", size = "sm", slot, ...rest } = props;

  // The slot goes on the `Button`, not on the trigger: under `asChild` the child writes its own
  // last and a `data-slot` here would never reach the document.
  return (
    <ArkFileUpload.ClearTrigger asChild>
      <Button
        {...rest}
        size={size}
        slot={slot ?? "file-upload-clear-trigger"}
        variant={variant}
      >
        {children}
      </Button>
    </ArkFileUpload.ClearTrigger>
  );
};

export const FileUploadHiddenInput = (
  { slot, ...rest }: React.ComponentProps<typeof ArkFileUpload.HiddenInput>
) => <ArkFileUpload.HiddenInput {...rest} data-slot={slot ?? "file-upload-hidden-input"} />;
