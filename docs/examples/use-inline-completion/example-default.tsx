"use client";

import {
  Button,
  ButtonGroup,
  Field,
  FieldDescription,
  FieldLabel,
  Kbd,
  Show,
  Textarea,
} from "@kanzo-tech/ui";
import {
  type InlineCompletionRequest,
  useInlineCompletion,
} from "@kanzo-tech/ai";
import { useRef, useState } from "react";
import { useAutoplay } from "@/lib/preview-autoplay";

const PACE = 55;
const NOTES = "Air quality stations, one row per reading";

export default function Example() {
  const [value, setValue] = useState(NOTES);
  const ref = useRef<HTMLTextAreaElement>(null);

  // The cadence is a ref so `settle` can run the SAME stub at 0 ms — under reduced motion the
  // ghost is simply there rather than typed out. `useInlineCompletion` reads its options through
  // a ref of its own, so redefining `complete` every render costs nothing.
  const pace = useRef(PACE);

  // A stub `complete`. It yields the CONTINUATION, never the whole value, and stops on abort.
  const complete = async function* ({ signal }: InlineCompletionRequest) {
    for (const chunk of " across every autonomous community, sampled hourly.".split(/(?<=\s)/)) {
      await new Promise((r) => setTimeout(r, pace.current));
      if (signal?.aborted) return;
      yield chunk;
    }
  };

  const completion = useInlineCompletion({ complete, debounceMs: 250, minLength: 3 });

  // `ask` aborts whatever was in flight first and each run captures its own signal, so a replay
  // cannot interleave with the run it replaces. **No focus is taken**: a preview that grabbed the
  // caret on scroll would hijack the reader's keyboard mid-page.
  useAutoplay((mode) => {
    pace.current = mode === "settle" ? 0 : PACE;
    setValue(NOTES);
    completion.ask(NOTES);
  });

  // The hook offers; this owns the value, so this is what inserts.
  const accept = () => {
    const text = completion.ghost;
    completion.dismiss();
    if (text) setValue((v) => v + text);
    ref.current?.focus();
  };

  return (
    <Field className="w-full max-w-md">
      <FieldLabel>Dataset notes</FieldLabel>
      <Textarea
        onChange={(e) => {
          setValue(e.target.value);
          // The caret, so an offer survives typing that agrees with it instead of being thrown away.
          completion.setValue(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (completion.ghost === "") return;
          if (e.key === "Tab") {
            e.preventDefault();
            accept();
          } else if (e.key === "Escape") {
            completion.dismiss();
          }
        }}
        placeholder="Describe the dataset…"
        ref={ref}
        rows={3}
        value={value}
      />

      <Show
        fallback={<FieldDescription>Type, or ask for a completion.</FieldDescription>}
        when={completion.ghost !== ""}
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
        <Button onClick={() => completion.ask(value)} size="sm" variant="outline">
          Complete now
        </Button>
        <Button disabled={completion.ghost === ""} onClick={accept} size="sm" variant="outline">
          Accept <Kbd>Tab</Kbd>
        </Button>
        <Button
          disabled={completion.ghost === ""}
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
