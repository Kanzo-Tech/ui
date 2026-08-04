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
  const [reward, setReward] = useState("");
  const [touched, setTouched] = useState(false);

  const error = /^\d*$/.test(reward) ? "" : "Rewards are written in figures.";

  return (
    <form className="w-full max-w-md" onSubmit={(e) => e.preventDefault()}>
      <FieldSet>
        <FieldLegend>Posting</FieldLegend>
        <FieldDescription>What the contract pays, and who may claim it.</FieldDescription>

        <FieldGroup>
          <Field invalid={touched && Boolean(error)} required>
            <FieldLabel>
              Reward
              <FieldRequiredIndicator />
            </FieldLabel>
            <Input
              onBlur={() => setTouched(true)}
              onChange={(e) => setReward(e.target.value)}
              placeholder="32"
              value={reward}
            />
            <FieldDescription>Gold, paid on delivery.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>

          <Field orientation="horizontal">
            <FieldLabel>Post to every hall</FieldLabel>
            <Switch defaultChecked />
          </Field>
        </FieldGroup>
      </FieldSet>

      <Button className="mt-6" type="submit">
        Post
      </Button>
    </form>
  );
}
