"use client";

import { useRef, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Kbd,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useCompletion,
} from "@kanzo-tech/ui";
import { SparklesIcon } from "lucide-react";

// A fake `complete` — a product would stream from its own model. It honours the signal so a
// superseded request stops yielding.
async function* complete(value: string, signal?: AbortSignal) {
  const rest =
    " and includes weekly demographic breakdowns suitable for secondary research.";
  for (const word of rest.split(/(?<=\s)/)) {
    await new Promise((r) => setTimeout(r, 40));
    if (signal?.aborted) return;
    yield word;
  }
}

export default function Example() {
  const [value, setValue] = useState("This dataset covers confirmed cases");
  const ref = useRef<HTMLTextAreaElement>(null);
  const completion = useCompletion({ complete });

  // The hook does not own the text — insert the accepted continuation into our own state.
  const accept = () => {
    const text = completion.accept();
    if (text) setValue((v) => v + text);
    ref.current?.focus();
  };

  return (
    <InputGroup className="w-full max-w-md">
      <InputGroupTextarea
        ref={ref}
        onChange={(e) => {
          setValue(e.target.value);
          completion.setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab" && completion.hasGhost) {
            e.preventDefault();
            accept();
          } else if (e.key === "Escape" && completion.hasGhost) {
            completion.dismiss();
          }
        }}
        onBlur={() => completion.clear()}
        placeholder="Describe the dataset…"
        rows={3}
        value={value}
      />
      <InputGroupAddon align="block-end">
        <InputGroupButton onClick={() => completion.request(value)} variant="ghost">
          <SparklesIcon />
          Suggest
        </InputGroupButton>
        {completion.hasGhost && (
          <span className="ms-auto flex min-w-0 items-center gap-3 text-muted-foreground text-xs">
            {/* Truncated inline; hover reveals the full continuation. */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="min-w-0 flex-1 cursor-default truncate italic">
                  …{completion.ghost}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {completion.ghost.replace(/^\s+/, "")}
              </TooltipContent>
            </Tooltip>
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>Tab</Kbd> accept
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Kbd>Esc</Kbd> dismiss
            </span>
          </span>
        )}
      </InputGroupAddon>
    </InputGroup>
  );
}
