"use client";

import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { Button, cn, Menu, MenuContent, MenuItem, MenuTrigger } from "@kanzo-tech/ui";
import { askAlternatives, type AskInput, type AskSpec } from "./ask.js";

export interface AskChipsProps {
  /** The spec the answer was read from — an `answer` part's `output.spec`. */
  spec: AskSpec;
  /** What Ask was asked over: the graph, each type alone, and the page's chips' types. */
  over: Pick<AskInput, "graph" | "types" | "under">;
  /** The spec with one chip changed. A chat asks it as it is: `chat.sendMessage(askEdit(spec))`. */
  onChange: (spec: AskSpec) => void;
  className?: string;
}

/**
 * **What an answer was read as, each part of it editable** — what is counted, what a chart is by,
 * each condition. A chip opens the values it can hold instead, computed from the data and checked by
 * Ask's own oracles before they are offered, so taking one re-reads the answer with no model and no
 * question in between. A chip with nothing else to hold is drawn, disabled: it still says what the
 * answer read.
 */
export function AskChips(props: AskChipsProps) {
  const { spec, over, onChange, className } = props;
  const chips = React.useMemo(() => askAlternatives(spec, { ...over, question: "" }), [spec, over]);
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} data-slot="ask-chips">
      {chips.map((chip) => (
        <Menu key={chip.slot} onSelect={({ value }) => onChange(chip.options[Number(value)]!.spec)}>
          <MenuTrigger asChild>
            <Button
              aria-label={`${chip.label}: ${chip.value}`}
              disabled={chip.options.length === 0}
              size="sm"
              variant="outline"
            >
              <span className="text-muted-foreground">{chip.slot.startsWith("where") ? `${chip.label}:` : chip.label}</span>
              {chip.value}
              <ChevronDownIcon />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {chip.options.map((option, n) => (
              <MenuItem key={n} value={String(n)}>
                {option.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      ))}
    </div>
  );
}
