"use client";

import {
  Button,
  ButtonGroup,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Kbd,
  Show,
  useCompletion,
} from "@kanzo-tech/ui";
import { useRef, useState } from "react";

// A stub `complete`. It yields the CONTINUATION, never the whole value, and stops on abort.
async function* complete(_value: string, signal?: AbortSignal) {
  for (const chunk of " across every autonomous community, sampled hourly.".split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 55));
    if (signal?.aborted) return;
    yield chunk;
  }
}

export default function Example() {
  const [value, setValue] = useState("Air quality stations");
  const ref = useRef<HTMLInputElement>(null);
  const completion = useCompletion({ complete, debounceMs: 250, minLength: 3 });

  // The hook does not hold the text — `accept()` hands back the continuation to insert.
  const accept = () => {
    const text = completion.accept();
    if (text) setValue((v) => v + text);
    ref.current?.focus();
  };

  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Dataset title</FieldLabel>
      <Input
        onChange={(e) => {
          setValue(e.target.value);
          completion.setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!completion.hasGhost) return;
          if (e.key === "Tab") {
            e.preventDefault();
            accept();
          } else if (e.key === "Escape") {
            completion.dismiss();
          }
        }}
        placeholder="Name the dataset…"
        ref={ref}
        value={value}
      />

      <Show
        fallback={<FieldDescription>Type, or ask for a completion.</FieldDescription>}
        when={completion.hasGhost}
      >
        <p className="text-sm">
          {value}
          <span className="text-muted-foreground italic">{completion.ghost}</span>
        </p>
      </Show>

      <Show when={completion.error !== null}>
        <p className="text-destructive text-xs">{completion.error}</p>
      </Show>

      <ButtonGroup aria-label="Completion actions">
        <Button onClick={() => completion.request(value)} size="sm" variant="outline">
          Complete now
        </Button>
        <Button disabled={!completion.hasGhost} onClick={accept} size="sm" variant="outline">
          Accept <Kbd>Tab</Kbd>
        </Button>
        <Button
          disabled={!completion.hasGhost}
          onClick={completion.dismiss}
          size="sm"
          variant="outline"
        >
          Dismiss <Kbd>Esc</Kbd>
        </Button>
      </ButtonGroup>
    </Field>
  );
}
