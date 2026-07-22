"use client";

import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldRequiredIndicator,
  FieldSet,
  Input,
  Switch,
} from "@kanzo-tech/ui";
import { useState } from "react";

/** The finished shape from the step-by-step guide: a fieldset, a group, a validated text
 *  field and a horizontal switch. State is plain useState — the library owns no form state. */
export default function Example() {
  const [endpoint, setEndpoint] = useState("");
  const [touched, setTouched] = useState(false);

  const error = endpoint.endsWith("/") ? "Remove the trailing slash." : "";

  return (
    <form className="w-full max-w-md" onSubmit={(e) => e.preventDefault()}>
      <FieldSet>
        <FieldLegend>Connection</FieldLegend>
        <FieldDescription>Where the dataset is pulled from.</FieldDescription>

        <FieldGroup>
          <Field invalid={touched && Boolean(error)} required>
            <FieldLabel>
              Endpoint
              <FieldRequiredIndicator />
            </FieldLabel>
            <Input
              onBlur={() => setTouched(true)}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.example.org"
              value={endpoint}
            />
            <FieldDescription>The base URL, without a trailing slash.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Verify TLS certificates</FieldLabel>
            <Switch defaultChecked />
          </Field>
        </FieldGroup>
      </FieldSet>

      <Button className="mt-6" type="submit">
        Save
      </Button>
    </form>
  );
}
