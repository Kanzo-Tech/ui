"use client";

import { useState } from "react";
import { FieldArray, Input } from "@kanzo-tech/ui";

const MAX = 4;

export default function Example() {
  const [values, setValues] = useState(["dcat:Dataset"]);

  return (
    <div className="w-80 space-y-2">
      <FieldArray
        addLabel="Add keyword"
        canAdd={values.length < MAX}
        canRemove={values.length > 1}
        count={values.length}
        onAdd={() => setValues((v) => [...v, ""])}
        onRemove={(index) =>
          setValues((v) => v.filter((_, j) => j !== index))
        }
        removeLabel="Remove keyword"
        rowKey={(index) => `keyword#${index}`}
      >
        {(index) => (
          <Input
            onChange={(event) =>
              setValues((v) =>
                v.map((x, j) => (j === index ? event.target.value : x))
              )
            }
            placeholder="Keyword"
            value={values[index] ?? ""}
          />
        )}
      </FieldArray>
      <p className="text-muted-foreground text-xs">
        {values.length}/{MAX} rows — “Add” hides at the maximum, and the last
        remaining row keeps its remove control hidden.
      </p>
    </div>
  );
}
