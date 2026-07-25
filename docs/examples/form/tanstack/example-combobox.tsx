"use client";

import {
  Button,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  useFilter,
  useListCollection,
} from "@kanzo-tech/ui";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import * as z from "zod";

const DATASETS = [
  { label: "customers", value: "customers" },
  { label: "orders", value: "orders" },
  { label: "products", value: "products" },
  { label: "suppliers", value: "suppliers" },
  { label: "invoices", value: "invoices" },
];

const schema = z.object({
  tables: z.array(z.string()).min(2, "Join at least two tables."),
});

export default function Example() {
  const { contains } = useFilter({ sensitivity: "base" });
  const { collection, filter } = useListCollection({
    initialItems: DATASETS,
    filter: contains,
  });

  const form = useForm({
    defaultValues: { tables: [] as string[] },
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
        <form.Field name="tables">
          {(field) => (
            <Field invalid={!field.state.meta.isValid}>
              <FieldLabel>Tables</FieldLabel>
              {/* Combobox holds a string[] whether or not it is multiple, so the form
                  value matches it exactly. */}
              <Combobox
                collection={collection}
                multiple
                name={field.name}
                onInputValueChange={(details) => filter(details.inputValue)}
                onValueChange={(details) => field.handleChange(details.value)}
                value={field.state.value}
              >
                <ComboboxInput
                  onBlur={field.handleBlur}
                  placeholder="Search tables…"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No tables found.</ComboboxEmpty>
                  {collection.items.map((item) => (
                    <ComboboxItem item={item} key={item.value}>
                      {item.label}
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </Combobox>
              <FieldError>
                {field.state.meta.errors.map((issue) => issue?.message).join(", ")}
              </FieldError>
            </Field>
          )}
        </form.Field>
      </FieldGroup>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
