"use client";

import { PromptInput, PromptInputHeader, PromptInputSubmit, PromptInputTextarea, PromptInputToolbar } from "@kanzo-tech/ai";
import { InputGroupButton, Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "@kanzo-tech/ui";
import { DatabaseIcon } from "lucide-react";
import { useState } from "react";

// The host's connections and the files each one holds.
const CONNECTIONS = [
  { id: "warehouse", name: "Warehouse", files: ["contracts.parquet", "regions.parquet", "awards.parquet"] },
  { id: "drive", name: "Shared drive", files: ["guild-roster.csv", "notices.csv"] },
];

export default function Example() {
  const [chosen, setChosen] = useState<Record<string, string[]>>({
    warehouse: ["contracts.parquet", "regions.parquet"],
    drive: [],
  });
  const [draft, setDraft] = useState("");

  const toggle = (connection: string, file: string, checked: boolean) =>
    setChosen((all) => ({
      ...all,
      [connection]: checked ? [...(all[connection] ?? []), file] : (all[connection] ?? []).filter((f) => f !== file),
    }));

  return (
    <PromptInput className="max-w-xl" onSubmit={(event) => event.preventDefault()}>
      <PromptInputHeader>
        {CONNECTIONS.map((connection) => (
          <Menu closeOnSelect={false} key={connection.id}>
            <MenuTrigger asChild>
              <InputGroupButton pill variant="outline">
                <DatabaseIcon />
                {connection.name} · {chosen[connection.id]?.length ?? 0} of {connection.files.length}
              </InputGroupButton>
            </MenuTrigger>
            <MenuContent className="w-52">
              {connection.files.map((file) => (
                <MenuCheckboxItem
                  checked={chosen[connection.id]?.includes(file) ?? false}
                  key={file}
                  onCheckedChange={(checked) => toggle(connection.id, file, checked)}
                  value={file}
                >
                  {file}
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </Menu>
        ))}
      </PromptInputHeader>
      <PromptInputTextarea onChange={(event) => setDraft(event.target.value)} placeholder="Ask about these files…" value={draft} />
      <PromptInputToolbar>
        <PromptInputSubmit disabled={!draft.trim()} />
      </PromptInputToolbar>
    </PromptInput>
  );
}
