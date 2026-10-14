import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DirectChatTransport, ToolLoopAgent, jsonSchema, tool } from "@kanzo-tech/llm";
import { describe, expect, it, vi } from "vitest";
import { Chat, ChatSkeleton } from "./chat.js";
import type { Proposal } from "./task/index.js";
import { useChat } from "@ai-sdk/react";
import { mockModel } from "./testing/model.js";

/** A Task's offer of `value`, accepted, as `propose` hands one over. */
const offer = <V,>(value: V, rationale?: string): Proposal<V> => ({
  id: `offer-${JSON.stringify(value)}`,
  task: "questions",
  value,
  target: { add: "" },
  verdict: { ok: true },
  attempts: 1,
  rationale,
});

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
      proposals={[offer("How many nodes are there?", "nodes")]}
      tools={
        props.draw
          ? { query: (part) => (part.state === "output-available" ? <p>Rows: {JSON.stringify(part.output)}</p> : <p>Counting…</p>) }
          : undefined
      }
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

  it("holds the answer's place in the transcript from the question sent until the model's first word", () => {
    const asked = { id: "u1", role: "user" as const, parts: [{ type: "text" as const, text: "How many nodes are there?" }] };
    const { rerender } = render(<Chat chat={{ ...idle, messages: [asked], status: "submitted" }} />);
    const waiting = document.querySelector("[data-slot=chat-waiting]");
    expect(waiting?.querySelector("[role=status]")?.textContent).toBe("Thinking…");

    const answering = { id: "a1", role: "assistant" as const, parts: [{ type: "text" as const, text: "There are", state: "streaming" as const }] };
    rerender(<Chat chat={{ ...idle, messages: [asked, answering], status: "streaming" }} />);
    expect(document.querySelector("[data-slot=chat-waiting]")).toBeNull();
  });

  it("lets the host draw its own tool's result", async () => {
    const user = userEvent.setup();
    render(<Harness draw />);
    await user.type(screen.getByPlaceholderText("Ask anything…"), "count{Enter}");
    expect(await screen.findByText('Rows: {"rows":4}')).not.toBeNull();
    // The host's drawing is the whole result: the input's JSON is not drawn above it a second time.
    expect(document.querySelector("[data-slot=tool-input]")).toBeNull();
  });

  it("hands the host's renderer every state, and says whether the call will ever settle", () => {
    const calls: { state: string; stopped: boolean }[] = [];
    const query = (state: string, status: string) => ({
      ...idle,
      status,
      messages: [{ id: "a", role: "assistant", parts: [{ type: "tool-query", toolCallId: "c", state, input: { sql: "select 1" } }] }],
    });
    const tools = { query: (part: { state: string }, call: { stopped: boolean }) => (calls.push({ state: part.state, ...call }), <p>drawn</p>) };
    const { rerender } = render(<Chat chat={query("input-available", "streaming") as never} tools={tools} />);
    // The answer stopped with the call still at `input-available`: it will never settle.
    rerender(<Chat chat={query("input-available", "ready") as never} tools={tools} />);
    expect(calls.at(0)).toEqual({ state: "input-available", stopped: false });
    expect(calls.at(-1)).toEqual({ state: "input-available", stopped: true });
    expect(document.querySelector("[data-slot=tool]")?.getAttribute("data-stopped")).toBe("true");
  });

  it("holds room for proposals still arriving, beside the ones that have", () => {
    const { rerender } = render(<Chat chat={idle as never} proposing proposals={[offer("First?", "first")]} />);
    expect(screen.getByRole("button", { name: "First?" })).not.toBeNull();
    expect(document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length).toBe(2);
    // As many skeletons as make up the strip, never an extra row once it is full.
    rerender(<Chat chat={idle as never} proposing proposals={["A?", "B?", "C?"].map((text) => offer(text))} />);
    expect(document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length).toBe(0);
  });

  it("draws the strip just above the composer, outside the transcript", () => {
    render(<Chat chat={idle as never} empty={<p>Ask about your graph.</p>} proposals={[offer("First?")]} />);
    const strip = document.querySelector("[data-slot=suggestions]");
    expect(strip?.closest("[data-slot=conversation-content]")).toBeNull();
    expect(strip?.nextElementSibling?.contains(screen.getByPlaceholderText("Ask anything…"))).toBe(true);
  });

  it("draws the host's notice in place of the pills when proposing failed, keeping the strip's row", () => {
    render(<Chat chat={idle as never} notice={<p>Proposing failed.</p>} proposing={false} proposals={[]} />);
    const strip = document.querySelector("[data-slot=suggestions]");
    expect(strip?.textContent).toBe("Proposing failed.");
    expect(strip?.className).toContain("min-h-7");
    expect(document.querySelector("[data-slot=suggestion]")).toBeNull();
  });

  it("shows what the next question is asked over in the composer, beside Send", () => {
    render(<Chat chat={idle as never} context={<span>Subset · 40 nodes</span>} />);
    const toolbar = document.querySelector('[data-slot="prompt-input-toolbar"]');
    expect(toolbar?.textContent).toContain("Subset · 40 nodes");
    expect(toolbar?.querySelector("button")).toBeTruthy();
  });

  it("sends a proposal's value, never its words: one that is not a string as the message the host makes of it", async () => {
    const sendMessage = vi.fn(async () => {});
    const spec = { of: "Award", by: "category" };
    const asked = (value: typeof spec) => ({
      parts: [
        { type: "text" as const, text: `Awards by ${value.by}` },
        { type: "data-ask" as const, data: { spec: value } },
      ],
    });
    render(<Chat chat={{ ...idle, sendMessage } as never} message={asked} proposals={[offer(spec)]} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Awards by category" }));
    expect(sendMessage).toHaveBeenCalledWith(asked(spec));
  });

  it("draws no strip for a host that offers no proposals", () => {
    render(<Chat chat={idle as never} />);
    expect(document.querySelector("[data-slot=suggestions]")).toBeNull();
  });
});

/** A chat state with nothing said yet. */
const idle = { messages: [], status: "ready", error: undefined, sendMessage: async () => {}, stop: async () => {}, regenerate: async () => {} };

/** The layout's slots in document order, below the root and leaving the pills out. */
const frame = (root: Element | null) =>
  [...(root?.querySelectorAll("[data-slot]") ?? [])]
    .map((el) => el.getAttribute("data-slot"))
    .filter((slot) => slot !== "skeleton" && slot !== "suggestion");

describe("ChatSkeleton", () => {
  it("draws Chat's layout before it can be drawn: the empty state, pills in skeleton, an inert composer", () => {
    render(<ChatSkeleton empty={<p>Ask about your graph.</p>} />);
    expect(screen.getByText("Ask about your graph.")).not.toBeNull();
    expect(document.querySelectorAll("[data-slot=suggestions] [data-slot=skeleton]").length).toBe(3);
    const field = screen.getByPlaceholderText("Ask anything…") as HTMLTextAreaElement;
    expect(field.disabled).toBe(true);
    expect(document.querySelector("[data-slot=chat-skeleton]")?.getAttribute("aria-busy")).toBe("true");
  });

  it("is Chat's own frame, so nothing moves when the chat replaces it", () => {
    const skeleton = render(<ChatSkeleton empty={<p>Ask about your graph.</p>} />);
    const before = frame(skeleton.container.querySelector("[data-slot=chat-skeleton]"));
    skeleton.unmount();
    const chat = render(<Chat chat={idle as never} empty={<p>Ask about your graph.</p>} proposing />);
    expect(frame(chat.container.querySelector("[data-slot=chat]"))).toEqual(before);
    expect(before).toContain("conversation-content");
  });
});
