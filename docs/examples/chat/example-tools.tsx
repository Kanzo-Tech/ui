"use client";

import { Chat, useChat } from "@kanzo-tech/ai";
import { DirectChatTransport, jsonSchema, tool, ToolLoopAgent } from "@kanzo-tech/llm";
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kanzo-tech/ui";
import { daysOverdue, overdueQuests } from "@/example/quests";
import { afterTool, mockModel } from "@/lib/mock-model";

interface Late {
  id: string;
  title: string;
  days: number;
}

// The host's tool: it runs here, in the agent, and its result goes back to the model AND to the
// transcript, where `tools` below draws it.
const late = tool({
  description: "List the contracts past their due day",
  inputSchema: jsonSchema<{ limit: number }>({
    type: "object",
    properties: { limit: { type: "number" } },
    required: ["limit"],
  }),
  execute: async ({ limit }): Promise<Late[]> =>
    overdueQuests()
      .slice(0, limit)
      .map((quest) => ({ id: quest.id, title: quest.title, days: daysOverdue(quest) })),
});

const model = mockModel((call) =>
  afterTool(call)
    ? `Those are the ${Math.min(3, overdueQuests().length)} longest overdue. Start with the first: it is the oldest.`
    : { reasoning: "The board knows what is late; ask it rather than guess.", tool: "late", input: { limit: 3 } },
);

const transport = new DirectChatTransport({ agent: new ToolLoopAgent({ model, tools: { late } }) });

export default function Example() {
  const chat = useChat({ transport });

  return (
    <div className="flex h-120 w-full max-w-xl flex-col">
      <Chat
        chat={chat}
        suggestions={[{ text: "Which contracts are late?" }]}
        tools={{
          // Without this the result is drawn as a JSON tree; with it, as what it is.
          late: (part) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead className="text-end">Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(part.output as Late[]).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.title}</TableCell>
                    <TableCell className="text-end">
                      <Badge variant="destructive">{row.days} days</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ),
        }}
      />
    </div>
  );
}
