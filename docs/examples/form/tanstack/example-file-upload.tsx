"use client";

import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FileUpload,
  FileUploadDropzone,
  FileUploadHiddenInput,
  FileUploadItem,
  FileUploadItemDeleteTrigger,
  FileUploadItemGroup,
  FileUploadItemName,
  FileUploadItemPreview,
  FileUploadItemSizeText,
  FileUploadLabel,
  FileUploadTrigger,
  useFileUpload,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { FileIcon, UploadCloudIcon, XIcon } from "lucide-react";
import * as z from "zod";

const schema = z.object({
  attachments: z
    .array(z.custom<File>())
    .min(1, "Attach at least one file.")
    .max(3, "Three files at most."),
});

function AcceptedFiles() {
  const fileUpload = useFileUpload();

  if (fileUpload.acceptedFiles.length === 0) return null;

  return (
    <FileUploadItemGroup>
      {fileUpload.acceptedFiles.map((file) => (
        <FileUploadItem file={file} key={file.name}>
          <FileUploadItemPreview>
            <FileIcon />
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
  const form = useForm({
    defaultValues: { attachments: [] as File[] },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: () => {},
  });

  return (
    <form
      className="w-full max-w-sm"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="attachments">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              {/* `acceptedFiles` is the controlled value; `onFileChange` fires for both
                  accepted and rejected drops, so it is the one to sync from. */}
              <FileUpload
                acceptedFiles={field.state.value}
                accept="text/csv"
                maxFiles={3}
                name={field.name}
                onFileChange={(details) =>
                  field.handleChange(details.acceptedFiles)
                }
              >
                <FileUploadLabel>Attachments</FileUploadLabel>
                <FileUploadDropzone>
                  <UploadCloudIcon className="size-6" />
                  <span className="font-medium text-foreground text-sm">
                    Drop CSV files here
                  </span>
                  <FileUploadTrigger className="mt-1" size="sm">
                    Browse files
                  </FileUploadTrigger>
                </FileUploadDropzone>

                <AcceptedFiles />

                <FileUploadHiddenInput />
              </FileUpload>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Upload
      </Button>
    </form>
  );
}
