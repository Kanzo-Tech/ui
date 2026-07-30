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
  const { className, ...rest } = props;

  return (
    <ArkFileUpload.Root
      className={cn(
        "flex flex-col gap-2",
        "data-invalid:text-destructive dark:data-invalid:text-destructive-foreground",
        className
      )}
      data-slot="file-upload"
      {...rest}
    />
  );
};

export const FileUploadLabel = (
  props: React.ComponentProps<typeof ArkFileUpload.Label>
) => (
  <FieldLabel asChild>
    <ArkFileUpload.Label data-slot="file-upload-label" {...props} />
  </FieldLabel>
);

export const FileUploadDropzone = (
  props: React.ComponentProps<typeof ArkFileUpload.Dropzone>
) => {
  const { className, ...rest } = props;

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
      data-slot="file-upload-dropzone"
      {...rest}
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
  const { className, ...rest } = props;

  return (
    <ArkFileUpload.ItemGroup
      className={cn("flex w-full flex-col gap-2", className)}
      data-slot="file-upload-item-group"
      {...rest}
    />
  );
};

export const FileUploadItem = (
  props: React.ComponentProps<typeof ArkFileUpload.Item>
) => {
  const { className, ...rest } = props;

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
      data-slot="file-upload-item"
      {...rest}
    />
  );
};

export const FileUploadItemPreview = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemPreview>
) => {
  const { className, ...rest } = props;

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
      data-slot="file-upload-item-preview"
      {...rest}
    />
  );
};

export const FileUploadItemName = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemName>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFileUpload.ItemName
      className={cn(
        "min-w-0 truncate font-medium text-foreground text-sm",
        className
      )}
      data-slot="file-upload-item-name"
      {...rest}
    />
  );
};

export const FileUploadItemSizeText = (
  props: React.ComponentProps<typeof ArkFileUpload.ItemSizeText>
) => {
  const { className, ...rest } = props;

  return (
    <ArkFileUpload.ItemSizeText
      className={cn("text-muted-foreground text-xs", className)}
      data-slot="file-upload-item-size-text"
      {...rest}
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

export const FileUploadHiddenInput = (
  props: React.ComponentProps<typeof ArkFileUpload.HiddenInput>
) => <ArkFileUpload.HiddenInput data-slot="file-upload-hidden-input" {...props} />;
