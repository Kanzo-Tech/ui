"use client";

import { useState } from "react";
import { FieldArray, Input } from "@kanzo-tech/ui";

export default function Example() {
  const [values, setValues] = useState(["Ravenna Sarkis", ""]);

  return (
    <div className="w-80">
      <FieldArray
        count={values.length}
        onAdd={() => setValues((v) => [...v, ""])}
        onRemove={(index) =>
          setValues((v) => v.filter((_, j) => j !== index))
        }
        rowKey={(index) => `party#${index}`}
      >
        {(index) => (
          <Input
            onChange={(event) =>
              setValues((v) =>
                v.map((x, j) => (j === index ? event.target.value : x))
              )
            }
            placeholder="Member"
            value={values[index] ?? ""}
          />
        )}
      </FieldArray>
    </div>
  );
}
