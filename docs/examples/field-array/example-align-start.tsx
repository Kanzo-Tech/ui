"use client";

import { useState } from "react";
import { FieldArray, Textarea } from "@kanzo-tech/ui";

export default function Example() {
  const [values, setValues] = useState(["A first note."]);

  return (
    <div className="w-80">
      <FieldArray
        align="start"
        count={values.length}
        onAdd={() => setValues((v) => [...v, ""])}
        onRemove={(index) =>
          setValues((v) => v.filter((_, j) => j !== index))
        }
        rowKey={(index) => `note#${index}`}
      >
        {(index) => (
          <Textarea
            onChange={(event) =>
              setValues((v) =>
                v.map((x, j) => (j === index ? event.target.value : x))
              )
            }
            placeholder="Note"
            value={values[index] ?? ""}
          />
        )}
      </FieldArray>
    </div>
  );
}
