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
import { GRADES, REGIONS } from "@/example/world";

const grades = createListCollection({
  items: GRADES.map((grade) => ({
    label: `${grade.value} — ${grade.label}`,
    value: String(grade.value),
  })),
});

const schema = z.object({
  title: z
    .string()
    .min(10, "Give the contract a title a poster would recognise.")
    .max(60, "Keep the title under 60 characters."),
  notice: z.string().min(20, "Say what the party is walking into — at least 20 characters."),
  region: z.enum(REGIONS, { error: "Pick a region." }),
  grade: z.enum(["1", "2", "3", "4", "5"], { error: "Pick a grade." }),
  party: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1, "Name required."),
        handle: z.string().regex(/^[a-z]+$/, "Handles are lowercase, one word."),
      })
    )
    .min(1, "A contract needs at least one name on it."),
  post: z.boolean(),
  orders: z.literal(true, { error: "You have to accept the standing orders." }),
});

let counter = 0;
const newSignatory = () => ({ id: `signatory-${++counter}`, name: "", handle: "" });

export default function Example() {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      title: "",
      notice: "",
      region: "",
      grade: "",
      party: [newSignatory()],
      post: false,
      orders: false,
    },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async () => {
      setSubmitError(null);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSubmitError("The board rejected it: a contract with that title is already open.");
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
          <FieldLegend>The work</FieldLegend>
          <FieldDescription>How the contract reads on the board.</FieldDescription>

          <FieldGroup>
            <form.Field name="title">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Title
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <Input
                    name={field.name}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="A wyrm under the granary"
                    value={field.state.value}
                  />
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="notice">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Notice
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
          <FieldLegend>Where and how bad</FieldLegend>

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
                    <NativeSelectOption value="">Select a region</NativeSelectOption>
                    {REGIONS.map((region) => (
                      <NativeSelectOption key={region} value={region}>
                        {region}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </Field>
              )}
            </form.Field>

            <form.Field name="grade">
              {(field) => (
                <Field invalid={!field.state.meta.isValid} required>
                  <FieldLabel>
                    Grade
                    <FieldRequiredIndicator />
                  </FieldLabel>
                  <Select
                    collection={grades}
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
                      <SelectValue placeholder="Select a grade" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.items.map((item) => (
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

        <form.Field mode="array" name="party">
          {(array) => (
            <FieldSet>
              <FieldLegend>Party</FieldLegend>
              <FieldDescription>Who signs for this contract.</FieldDescription>

              <FieldGroup>
                {array.state.value.map((signatory, index) => (
                  <div
                    className="flex items-start gap-2 rounded-lg border p-3"
                    key={signatory.id}
                  >
                    <FieldGroup className="gap-3">
                      <form.Field name={`party[${index}].name`}>
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

                      <form.Field name={`party[${index}].handle`}>
                        {(field) => (
                          <Field invalid={!field.state.meta.isValid}>
                            <FieldLabel>Handle</FieldLabel>
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
                        aria-label={`Remove signatory ${index + 1}`}
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
                onClick={() => array.pushValue(newSignatory())}
                size="sm"
                type="button"
                variant="outline"
              >
                Add member
              </Button>
            </FieldSet>
          )}
        </form.Field>

        <FieldGroup>
          <form.Field name="post">
            {(field) => (
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>Post to the board on save</FieldLabel>
                  <FieldDescription>
                    Any chartered hall will be able to claim it.
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

          <form.Field name="orders">
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
                  <FieldTitle>Accept the hall’s standing orders</FieldTitle>
                  <FieldError>{errorText(field.state.meta.errors)}</FieldError>
                </FieldContent>
              </Field>
            )}
          </form.Field>
        </FieldGroup>

        <Show when={!!submitError}>
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Could not post the contract</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        </Show>

        <div className="flex items-center gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Posting…" : "Post"}
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
