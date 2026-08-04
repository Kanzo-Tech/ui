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
  plates: z
    .array(z.custom<File>())
    .min(1, "Attach at least one plate.")
    .max(3, "Three plates at most."),
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
          <FileUploadItemDeleteTrigger aria-label="Remove plate">
            <XIcon />
          </FileUploadItemDeleteTrigger>
        </FileUploadItem>
      ))}
    </FileUploadItemGroup>
  );
}

export default function Example() {
  const form = useForm({
    defaultValues: { plates: [] as File[] },
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
        <form.Field name="plates">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              {/* `acceptedFiles` is the controlled value; `onFileChange` fires for both
                  accepted and rejected drops, so it is the one to sync from. */}
              <FileUpload
                acceptedFiles={field.state.value}
                accept="image/*"
                maxFiles={3}
                name={field.name}
                onFileChange={(details) =>
                  field.handleChange(details.acceptedFiles)
                }
              >
                <FileUploadLabel>Survey plates</FileUploadLabel>
                <FileUploadDropzone>
                  <UploadCloudIcon className="size-6" />
                  <span className="font-medium text-foreground text-sm">
                    Drop the surveyor’s plates here
                  </span>
                  <FileUploadTrigger className="mt-1" size="sm">
                    Browse the archive
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
        Attach
      </Button>
    </form>
  );
}
