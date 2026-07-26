"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Checkbox,
  createListCollection,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldRequiredIndicator,
  FieldSet,
  FieldTitle,
  Input,
  NativeSelect,
  NativeSelectOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Show,
  Switch,
  Textarea,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { AlertCircleIcon, XIcon } from "lucide-react";
import { useState } from "react";
import * as z from "zod";

const licences = createListCollection({
  items: [
    { label: "CC BY 4.0", value: "cc-by-4.0" },
    { label: "CC BY-SA 4.0", value: "cc-by-sa-4.0" },
    { label: "CC0 1.0", value: "cc0-1.0" },
    { label: "Proprietary", value: "proprietary" },
  ],
});

const schema = z.object({
  name: z
    .string()
    .min(3, "Give the dataset a name of at least 3 characters.")
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  summary: z.string().min(20, "Describe the dataset in at least 20 characters."),
  region: z.enum(["eu-west", "eu-central", "us-east"], {
    error: "Pick a region.",
  }),
  licence: z.enum(["cc-by-4.0", "cc-by-sa-4.0", "cc0-1.0", "proprietary"], {
    error: "Pick a licence.",
  }),
  maintainers: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name required."),
        email: z.email("Not an email address."),
      })
    )
    .min(1, "A dataset needs at least one maintainer."),
  publish: z.boolean(),
  terms: z.literal(true, { error: "You have to accept the terms." }),
});

let counter = 0;
const newMaintainer = () => ({ id: `m-${++counter}`, name: "", email: "" });

export default function Example() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: "",
      summary: "",
      region: "",
      licence: "",
      maintainers: [newMaintainer()],
      publish: false,
      terms: false,
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async () => {
      setSubmitError(null);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSubmitError("The registry rejected the name: it is already taken.");
    },
  });

  const errorText = (issues: Array<{ message: string } | undefined>) =>
    issues.map((issue) => issue?.message).join(", ");

  return (
    <form
      className="w-full max-w-lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-8">
        <FieldSet>
          <FieldLegend>Identity</FieldLegend>
          <FieldDescription>How the dataset is listed publicly.</FieldDescription>

          <FieldGroup>
            <form.Field name="name">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Name
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <Input
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="air-quality-2024"
                    value={field.state.value}
                  />
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="summary">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Summary
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <Textarea
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    rows={3}
                    value={field.state.value}
                  />
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Hosting</FieldLegend>

          <FieldGroup>
            <form.Field name="region">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Region
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <NativeSelect
                    className="w-full"
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <NativeSelectOption value="">
                      Select a region
                    </NativeSelectOption>
                    <NativeSelectOption value="eu-west">EU West</NativeSelectOption>
                    <NativeSelectOption value="eu-central">
                      EU Central
                    </NativeSelectOption>
                    <NativeSelectOption value="us-east">US East</NativeSelectOption>
                  </NativeSelect>
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="licence">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Licence
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <Select
                    collection={licences}
                    name={field.name}
                    onOpenChange={(details) => {
                      if (!details.open) field.handleBlur();
                    }}
                    onValueChange={(details) =>
                      field.handleChange(details.value[0] ?? "")
                    }
                    value={field.state.value ? [field.state.value] : []}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a licence" />
                    </SelectTrigger>
                    <SelectContent>
                      {licences.items.map((item) => (
                        <SelectItem item={item} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </FieldSet>

        <form.Field mode="array" name="maintainers">
          {(array) => (
            <FieldSet>
              <FieldLegend>Maintainers</FieldLegend>
              <FieldDescription>Who to contact about this dataset.</FieldDescription>

              <FieldGroup>
                {array.state.value.map((maintainer, index) => (
                  <div
                    className="flex items-start gap-2 rounded-lg border p-3"
                    key={maintainer.id}
                  >
                    <FieldGroup className="gap-3">
                      <form.Field name={`maintainers[${index}].name`}>
                        {(field) => (
                          <Field invalid={!field.state.meta.isValid}>
                            <FieldLabel>Name</FieldLabel>
                            <Input
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              size="sm"
                              value={field.state.value}
                            />
                            <FieldError>
                              {errorText(field.state.meta.errors)}
                            </FieldError>
                          </Field>
                        )}
                      </form.Field>

                      <form.Field name={`maintainers[${index}].email`}>
                        {(field) => (
                          <Field invalid={!field.state.meta.isValid}>
                            <FieldLabel>Email</FieldLabel>
                            <Input
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                field.handleChange(event.target.value)
                              }
                              size="sm"
                              value={field.state.value}
                            />
                            <FieldError>
                              {errorText(field.state.meta.errors)}
                            </FieldError>
                          </Field>
                        )}
                      </form.Field>
                    </FieldGroup>

                    <Show when={array.state.value.length > 1}>
                      <Button
                        aria-label={`Remove maintainer ${index + 1}`}
                        onClick={() => array.removeValue(index)}
                        size="icon-sm"
                        type="button"
                        variant="ghost"
                      >
                        <XIcon />
                      </Button>
                    </Show>
                  </div>
                ))}
              </FieldGroup>

              <Field invalid={!array.state.meta.isValid}>
                <FieldError>{errorText(array.state.meta.errors)}</FieldError>
              </Field>

              <Button
                className="w-fit"
                onClick={() => array.pushValue(newMaintainer())}
                size="sm"
                type="button"
                variant="outline"
              >
                Add maintainer
              </Button>
            </FieldSet>
          )}
        </form.Field>

        <FieldGroup>
          <form.Field name="publish">
            {(field) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>Publish on save</FieldLabel>
                  <FieldDescription>
                    Anyone with the link will be able to read it.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  checked={field.state.value}
                  name={field.name}
                  onCheckedChange={(details) => field.handleChange(details.checked)}
                />
              </Field>
            )}
          </form.Field>

          <form.Field name="terms">
            {(field) => (
              <Field invalid={!field.state.meta.isValid} orientation="horizontal">
                <Checkbox
                  checked={field.state.value}
                  name={field.name}
                  onCheckedChange={(details) =>
                    field.handleChange(details.checked === true)
                  }
                />
                <FieldContent>
                  <FieldTitle>Accept the terms of use</FieldTitle>
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </FieldContent>
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <Show when={!!submitError}>
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Could not publish</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        </Show>

        <div className="flex items-center gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Publishing…" : "Publish"}
              </Button>
            )}
          </form.Subscribe>

          <Button
            onClick={() => {
              form.reset();
              setSubmitError(null);
            }}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>
    </form>
  );
}
