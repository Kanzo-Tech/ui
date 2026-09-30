"use client";

import {
  Field,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  LanguagePicker,
} from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  const [title, setTitle] = useState("Escort the salt convoy");
  const [tag, setTag] = useState("en");

  return (
    <Field className="w-80">
      <FieldLabel>Contract title</FieldLabel>
      <InputGroup>
        <InputGroupInput onChange={(event) => setTitle(event.target.value)} value={title} />
        <InputGroupAddon align="inline-end">
          {/* The tag belongs to the text, so it sits in the text's own control; `inline` draws only
              the input, and the group around it supplies the box. */}
          <LanguagePicker aria-label="Language of the title" inline onValueChange={setTag} value={tag} />
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
