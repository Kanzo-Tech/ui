"use client";

import { Field, FieldHelper, FieldLabel, LanguagePicker } from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  const [tag, setTag] = useState("es");

  return (
    <Field className="w-72">
      <FieldLabel>Language of the report</FieldLabel>
      <LanguagePicker onValueChange={setTag} value={tag} />
      <FieldHelper>
        <code>lang="{tag || "…"}"</code>
      </FieldHelper>
    </Field>
  );
}
