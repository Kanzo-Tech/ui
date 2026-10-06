import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectChatTransport, ToolLoopAgent, jsonSchema, tool } from "@kanzo-tech/llm";
import { describe, expect, it } from "vitest";
import { Chat, ChatSkeleton } from "./chat.js";
import { useChat } from "@ai-sdk/react";
import { mockModel } from "./testing/model.js";

/** An agent with one tool, `query`, that the mock model calls once before it answers. */
function agent() {
  const { model } = mockModel((_, i) =>
    i === 0 ? { tool: "query", input: { sql: "select count(*) from node" } } : "There are **4** nodes.",
  );
  return new ToolLoopAgent({
    model,
    tools: {
      query: tool({
        description: "Run SQL over the graph",
        inputSchema: jsonSchema<{ sql: string }>({
          type: "object",
          properties: { sql: { type: "string" } },
          required: ["sql"],
        }),
        execute: async () => ({ rows: 4 }),
      }),
    },
  });
}

function Harness(props: { draw?: boolean }) {
  const chat = useChat({ transport: new DirectChatTransport({ agent: agent() }) });
  return (
    <Chat
      chat={chat}
      empty={<p>Ask about your graph.</p>}
      suggestions={[{ text: "How many nodes are there?", rationale: "nodes" }]}
      tools={props.draw ? { query: (part) => <p>Rows: {JSON.stringify(part.output)}</p> } : undefined}
    />
  );
}

describe("Chat", () => {
  it("starts empty, with the questions to start from", () => {
    render(<Harness />);
    expect(screen.getByText("Ask about your graph.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "How many nodes are there?" })).not.toBeNull();
  });

  it("asks, shows the tool call the model made, and streams the answer as markdown", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "How many nodes are there?" }));

    expect(await screen.findByText("How many nodes are there?", { selector: "p" })).not.toBeNull();
    await waitFor(() => expect(document.querySelector("[data-slot=tool]")?.getAttribute("data-state")).toBe("output-available"));
    expect(document.querySelector("[data-slot=tool-header]")?.textContent).toContain("query");
    await waitFor(() =>
      expect(document.querySelector('[data-slot=message-markdown] [data-streamdown="strong"]')?.textContent).toBe("4"),
    );
  });

  it("lets the host draw its own tool's result", async () => {
    const user = userEvent.setup();
    render(<Harness draw />);
    await user.type(screen.getByPlaceholderText("Ask anything…"), "count{Enter}");
    expect(await screen.findByText('Rows: {"rows":4}')).not.toBeNull();
    // The host's drawing is the whole result: the input's JSON is not drawn above it a second time.
    expect(document.querySelector("[data-slot=tool-input]")).toBeNull();
  });

  it("holds room for suggestions still arriving, beside the ones that have", () => {
    const chat = { messages: [], status: "ready", error: undefined, sendMessage: async () => {}, stop: async () => {}, regenerate: async () => {} };
    const { rerender } = render(<Chat chat={chat as never} suggesting suggestions={[{ text: "First?", rationale: "first" }]} />);
    expect(screen.getByRole("button", { name: "First?" })).not.toBeNull();
    expect(document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length).toBe(2);
    // Suggesting failed: no pills, and the composer is still there to ask with.
    rerender(<Chat chat={chat as never} suggesting={false} suggestions={[]} />);
    expect(document.querySelector("[data-slot=suggestions]")).toBeNull();
    expect(screen.getByPlaceholderText("Ask anything…")).not.toBeNull();
  });
});

describe("ChatSkeleton", () => {
  it("draws Chat's layout before it can be drawn: the empty state, pills in skeleton, an inert composer", () => {
    render(<ChatSkeleton empty={<p>Ask about your graph.</p>} />);
    expect(screen.getByText("Ask about your graph.")).not.toBeNull();
    expect(document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length).toBe(3);
    const field = screen.getByPlaceholderText("Ask anything…") as HTMLTextAreaElement;
    expect(field.disabled).toBe(true);
    expect(document.querySelector("[data-slot=chat-skeleton]")?.getAttribute("aria-busy")).toBe("true");
  });
});
