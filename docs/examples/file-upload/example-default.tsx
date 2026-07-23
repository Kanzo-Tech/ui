"use client";

import { ImageIcon, UploadCloudIcon, XIcon } from "lucide-react";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadItem,
  FileUploadItemDeleteTrigger,
  FileUploadItemGroup,
  FileUploadItemName,
  FileUploadItemPreview,
  FileUploadItemSizeText,
  FileUploadTrigger,
  useFileUpload,
} from "@kanzo-tech/ui";

function UploadedFiles() {
  const fileUpload = useFileUpload();

  if (fileUpload.acceptedFiles.length === 0) return null;

  return (
    <FileUploadItemGroup>
      {fileUpload.acceptedFiles.map((file) => (
        <FileUploadItem file={file} key={file.name}>
          <FileUploadItemPreview>
            <ImageIcon />
          </FileUploadItemPreview>
          <div className="flex min-w-0 flex-col">
            <FileUploadItemName />
            <FileUploadItemSizeText />
          </div>
          <FileUploadItemDeleteTrigger aria-label="Remove file">
            <XIcon />
          </FileUploadItemDeleteTrigger>
        </FileUploadItem>
      ))}
    </FileUploadItemGroup>
  );
}

export default function Example() {
  return (
    <FileUpload accept="image/*" className="w-full max-w-sm" maxFiles={3}>
      <FileUploadDropzone>
        <UploadCloudIcon className="size-6" />
        <span className="font-medium text-foreground text-sm">
          Drag images here
        </span>
        <span className="text-muted-foreground text-xs">
          PNG or JPG, up to 3 files
        </span>
        <FileUploadTrigger className="mt-1" size="sm">
          Browse files
        </FileUploadTrigger>
      </FileUploadDropzone>

      <UploadedFiles />

      <FileUploadHiddenInput />
    </FileUpload>
  );
}
