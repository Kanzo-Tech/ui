"use client";

import { Checkbox, CheckboxGroup } from "@kanzo-tech/ui";
import { useState } from "react";

/**
 * `CheckboxGroup` holds one value ARRAY for several checkboxes, so the group is the thing you
 * submit rather than N independent booleans you have to reassemble.
 *
 * The parent here is the classic use for `indeterminate`: it is checked when everything is,
 * unchecked when nothing is, and indeterminate in between — a state a plain boolean cannot
 * represent, which is why people end up with two of them.
 */
const FORMATS = ["CSV", "JSON", "Parquet"];

export default function Example() {
  const [value, setValue] = useState<string[]>(["CSV"]);

  const all = value.length === FORMATS.length;
  const none = value.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Checkbox
        checked={all ? true : none ? false : "indeterminate"}
        onCheckedChange={(d) => setValue(d.checked === true ? FORMATS : [])}
      >
        All formats
      </Checkbox>

      <CheckboxGroup
        className="ms-6 flex flex-col gap-3"
        onValueChange={setValue}
        value={value}
      >
        {FORMATS.map((f) => (
          <Checkbox key={f} value={f}>
            {f}
          </Checkbox>
        ))}
      </CheckboxGroup>
    </div>
  );
}
