"use client";

import { Field, FieldLabel, Input, useDebouncedCommit } from "@kanzo-tech/ui";
import { useState } from "react";

export default function Example() {
  const [writes, setWrites] = useState<string[]>([]);
  const [name, setName] = useState("");

  // The owner is the expensive side: every write here would rebuild and revalidate a document.
  const { change, draft, flush } = useDebouncedCommit(name, (next) => {
    setName(next);
    setWrites((all) => [...all, next]);
  });

  return (
    <div className="flex w-72 flex-col gap-2">
      <Field>
        <FieldLabel>Contract title</FieldLabel>
        <Input
          onBlur={flush}
          onChange={(event) => change(event.target.value)}
          placeholder="Type, then pause"
          value={draft}
        />
      </Field>
      <p className="text-muted-foreground text-sm">
        {writes.length} {writes.length === 1 ? "write" : "writes"}
        {writes.length > 0 && <> — last: <code>{writes.at(-1)}</code></>}
      </p>
    </div>
  );
}
