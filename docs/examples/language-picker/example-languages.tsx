"use client";

import { Field, FieldHelper, FieldLabel, LanguagePicker } from "@kanzo-tech/ui";
import { useState } from "react";

// The contract is published in three languages, so those are the only ones a translation can be in.
const OFFERED = ["en", "es", "ca"];

export default function Example() {
  const [tag, setTag] = useState("ca");

  return (
    <Field className="w-72">
      <FieldLabel>Translation</FieldLabel>
      <LanguagePicker languages={OFFERED} onValueChange={setTag} value={tag} />
      <FieldHelper>Published in English, Spanish and Catalan.</FieldHelper>
    </Field>
  );
}
