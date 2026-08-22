"use client";

import { UploadCloudIcon, XIcon } from "lucide-react";
import {
  Badge,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadItem,
  FileUploadItemDeleteTrigger,
  FileUploadItemGroup,
  FileUploadItemName,
  FileUploadItemSizeText,
  FileUploadTrigger,
  Show,
  useFileUpload,
} from "@kanzo-tech/ui";

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kB`;

// A CHILD of `<FileUpload>`, and that is the whole rule: the hook reads the machine from context,
// so the component that renders the root cannot call it — there is no provider above itself yet.
//
// What it computes is the reason to reach for the hook at all. `FileUploadItemSizeText` prints one
// file's size; a count and a total across all of them is arithmetic no part does, and the numbers
// live in the machine rather than in any state of yours.
function Tally() {
  const { acceptedFiles } = useFileUpload();
  const total = acceptedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <Show when={acceptedFiles.length > 0}>
      <Badge variant="secondary">
        {acceptedFiles.length} of 3 · {kb(total)}
      </Badge>
    </Show>
  );
}

function Plates() {
  const { acceptedFiles } = useFileUpload();

  return (
    <Show when={acceptedFiles.length > 0}>
      <FileUploadItemGroup>
        {acceptedFiles.map((file) => (
          <FileUploadItem file={file} key={file.name}>
            <div className="flex min-w-0 flex-col">
              <FileUploadItemName />
              <FileUploadItemSizeText />
            </div>
            <FileUploadItemDeleteTrigger aria-label={`Remove ${file.name}`}>
              <XIcon />
            </FileUploadItemDeleteTrigger>
          </FileUploadItem>
        ))}
      </FileUploadItemGroup>
    </Show>
  );
}

export default function Example() {
  return (
    <FileUpload accept="image/*" className="w-full max-w-sm" maxFiles={3}>
      <FileUploadDropzone>
        <UploadCloudIcon className="size-6" />
        <span className="font-medium text-foreground text-sm">
          Drag the surveyor’s plates here
        </span>
        <FileUploadTrigger className="mt-1" size="sm">
          Browse the archive
        </FileUploadTrigger>
      </FileUploadDropzone>

      <Tally />
      <Plates />

      <FileUploadHiddenInput />
    </FileUpload>
  );
}
