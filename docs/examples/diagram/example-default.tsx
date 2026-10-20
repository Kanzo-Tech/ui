"use client";

import { useState } from "react";
import { DiagramCanvas, DiagramControls, DiagramRoot, type DiagramEdge } from "@kanzo-tech/graph/diagram";
import { Badge, Button, Popover, PopoverContent, PopoverDescription, PopoverTrigger, Show } from "@kanzo-tech/ui";
import { CircleHelpIcon } from "lucide-react";

/** The host's own records: the diagram only ever sees their ids. */
const KINDS: Record<string, { name: string; count: number; fields: string[]; question?: string }> = {
  award: { name: "Award", count: 12, fields: ["name", "year"], question: "Is an award given once a year, or more often?" },
  person: { name: "Person", count: 340, fields: ["name", "born"] },
  country: { name: "Country", count: 41, fields: ["name"] },
  institution: { name: "Institution", count: 88, fields: ["name", "city"], question: "Is a city always in one country?" },
};

const EDGES: DiagramEdge[] = [
  { id: "award-person", source: "award", target: "person", label: "won by" },
  { id: "person-country", source: "person", target: "country", label: "born in" },
  { id: "person-institution", source: "person", target: "institution", label: "worked at" },
  { id: "institution-country", source: "institution", target: "country", label: "in" },
];

/**
 * Four kinds of thing and how they relate. Each box is the host's markup — a name, a count, its
 * fields, and a marker whose popover asks a question; the marker stops its click so that asking does
 * not also select. A click on a box, or Enter on a focused one, selects it.
 */
export default function Example() {
  const [selected, setSelected] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  return (
    <div className="relative h-96 w-full overflow-hidden rounded-lg border bg-background">
      <DiagramRoot edges={EDGES} nodes={Object.keys(KINDS)} onFailure={setFailure} onSelect={setSelected} selected={selected}>
        <DiagramCanvas>
          {(id, state) => {
            const kind = KINDS[id]!;
            return (
              <div
                className="flex w-44 flex-col gap-1.5 rounded-lg border bg-card p-2.5 text-sm shadow-sm data-[selected]:border-primary"
                data-selected={state.selected || undefined}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{kind.name}</span>
                  <Badge size="xs" variant="outline">
                    {kind.count}
                  </Badge>
                  <Show when={kind.question !== undefined}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button aria-label="Open question" className="ms-auto" onClick={(event) => event.stopPropagation()} size="icon-sm" variant="ghost">
                          <CircleHelpIcon />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <PopoverDescription>{kind.question}</PopoverDescription>
                      </PopoverContent>
                    </Popover>
                  </Show>
                </div>
                {kind.fields.map((field) => (
                  <span className="text-muted-foreground text-xs" key={field}>
                    {field}
                  </span>
                ))}
              </div>
            );
          }}
        </DiagramCanvas>
        <DiagramControls className="absolute end-2 top-2" />
      </DiagramRoot>
      <Show when={failure !== null}>
        <p className="absolute inset-0 grid place-items-center text-muted-foreground text-sm">The diagram could not be laid out.</p>
      </Show>
    </div>
  );
}
