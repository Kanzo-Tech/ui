"use client";

import { useState } from "react";
import {
  Badge,
  EmptyDescription,
  EmptyHeader,
  EmptyIndicator,
  EmptyRoot,
  Separator,
  ShellAside,
  ShellBody,
  ShellHeader,
  ShellMain,
  ShellRoot,
} from "@kanzo-tech/ui";
import { Chat, useChat } from "@kanzo-tech/ai";
import { DirectChatTransport, ToolLoopAgent, jsonSchema, tool } from "@kanzo-tech/llm";
import { SparklesIcon } from "lucide-react";
import { afterTool, askOf, mockModel } from "@/lib/mock-model";
import { NOTHING, RECIPES, RELATIONS, type ResultSet, recipeFor, runStatement } from "./data";
import { ResultTable } from "./result-table";

/**
 * Discovery — a question over a corpus, answered by a statement somebody can read.
 *
 * The screen this rebuilds is a text-to-SQL panel written by hand: a message type carrying `sql`,
 * `reasoning`, `explanation`, an error `code` and a `phase` string, with the phase rendered as a
 * spinner and a word and the result as a `<Table>` assembled in place from `Object.keys(data[0])`.
 * Here it is an agent with one tool. The model's thinking, the call it made with the statement it
 * wrote, the call's state and the answer are all the AI SDK's message parts, drawn by `Chat`; the
 * one thing this file draws is the tool's result, as the real table.
 *
 * The model is a mock that phrases five canned answers; the statement it writes is run by `query`
 * over `@/example`, so the rows and every number in the answer are computed, not written.
 */

const QUERY = jsonSchema<{ sql: string }>({
  type: "object",
  properties: { sql: { type: "string", description: "One SQL statement over the archive." } },
  required: ["sql"],
});

/** Reasons, calls `query` with the recipe's statement, then explains the rows it got back. */
const model = mockModel((call) => {
  const recipe = recipeFor(askOf(call));
  if (!recipe) return NOTHING;
  if (!afterTool(call)) return { reasoning: recipe.reasoning, tool: "query", input: { sql: recipe.sql } };
  return recipe.failure
    ? `No statement over this archive can answer that. ${recipe.failure}`
    : recipe.explain(recipe.run());
});

const agent = new ToolLoopAgent({
  model,
  tools: {
    query: tool({
      description: "Run one SQL statement over the Guild's archive.",
      inputSchema: QUERY,
      execute: async ({ sql }): Promise<ResultSet> => runStatement(sql),
    }),
  },
});

/** The schema the agent is given before it writes anything — the reader gets the same thing. */
function Schema() {
  return (
    <ShellAside
      aria-label="The archive"
      className="hidden overflow-y-auto bg-card p-3 md:flex"
      side="start"
      width={288}
    >
      <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        The archive
      </p>
      <div className="flex flex-col gap-4">
        {RELATIONS.map((relation) => (
          <section key={relation.name}>
            <h2 className="flex items-center gap-2 font-mono text-sm">
              {relation.name}
              <Badge size="sm" variant="outline">
                {relation.rows} rows
              </Badge>
            </h2>
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
              {relation.note}
            </p>
            <Separator className="my-2" />
            <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
              {relation.columns.map((column) => (
                <li key={column}>{column}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ShellAside>
  );
}

export function DiscoveryShowcase() {
  const [transport] = useState(() => new DirectChatTransport({ agent }));
  const chat = useChat({ transport });

  return (
    <ShellRoot className="bg-background">
      <ShellHeader className="gap-1 px-4 py-3">
        <h1 className="font-semibold text-lg">Discovery</h1>
        <p className="text-muted-foreground text-sm">
          Ask the Guild&rsquo;s archive a question. The phrasing is canned; the
          statement, the rows and every number in the answer are not.
        </p>
      </ShellHeader>

      <ShellBody>
        <Schema />

        <ShellMain className="min-h-0 overflow-hidden">
          <Chat
            chat={chat}
            className="mx-auto w-full max-w-3xl p-3"
            empty={
              <EmptyRoot>
                <EmptyHeader>
                  <EmptyIndicator>
                    <SparklesIcon />
                  </EmptyIndicator>
                  <EmptyDescription>
                    Ask about the contracts or the roster. These are the
                    questions this agent can answer; anything else it refuses
                    rather than guesses.
                  </EmptyDescription>
                </EmptyHeader>
              </EmptyRoot>
            }
            suggestions={RECIPES.map((recipe) => ({ text: recipe.question }))}
            tools={{
              // The columns are not known until the statement is written, so the result is drawn
              // from its own shape — the case a host's renderer exists for.
              query: (part) => {
                const result = part.output as ResultSet;
                return <ResultTable columns={result.columns} rows={result.rows} />;
              },
            }}
            translations={{ placeholder: "Ask about the archive…" }}
          />
        </ShellMain>
      </ShellBody>
    </ShellRoot>
  );
}
