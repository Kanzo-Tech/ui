"use client";

import { useState } from "react";
import { FieldArray, Input } from "@kanzo-tech/ui";

export default function Example() {
  const [values, setValues] = useState(["dcat:Dataset", ""]);

  return (
    <div className="w-80">
      <FieldArray
        count={values.length}
        onAdd={() => setValues((v) => [...v, ""])}
        onRemove={(index) =>
          setValues((v) => v.filter((_, j) => j !== index))
        }
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
    </div>
  );
}
