"use client";

import { Source, Sources, SourcesContent, SourcesTrigger } from "@kanzo-tech/ai";
import { DatabaseIcon } from "lucide-react";

// What the person said the data is about, and the sources they picked.
const ABOUT = "Grants the guild awarded between 2015 and 2024, by region.";
const SOURCES = [
  { name: "Warehouse", files: 2 },
  { name: "Shared drive", files: 1 },
];

export default function Example() {
  return (
    <Sources className="max-w-md rounded-xl border bg-card px-3 py-2.5" defaultOpen>
      <SourcesTrigger count={SOURCES.length} />
      <SourcesContent>
        <p className="basis-full text-muted-foreground">{ABOUT}</p>
        {SOURCES.map((source) => (
          <Source key={source.name}>
            <DatabaseIcon />
            {source.name} · {source.files}
          </Source>
        ))}
      </SourcesContent>
    </Sources>
  );
}
