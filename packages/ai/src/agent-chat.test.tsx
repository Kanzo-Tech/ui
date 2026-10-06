import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiError, ToolLoopAgent } from "@kanzo-tech/llm";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { useAgentChat } from "./agent-chat.js";
import { Chat } from "./chat.js";
import { mockModel } from "./testing/model.js";

const limited = new AiError("ai/rate-limited", "Over the organisation's limit.", { retryAfter: 30 });

function Harness(props: { agent: ToolLoopAgent; seen?: (error: unknown) => void }) {
  const chat = useAgentChat(props.agent);
  props.seen?.(chat.error);
  return <Chat chat={chat} />;
}

describe("useAgentChat", () => {
  it("answers what the agent threw, whole, and Chat draws it with its code", async () => {
    const agent = new ToolLoopAgent({
      model: new MockLanguageModelV4({
        doStream: async () => {
          throw limited;
        },
      }),
      maxRetries: 0,
    });
    let error: unknown;
    render(<Harness agent={agent} seen={(e) => (error = e)} />);
    await userEvent.setup().type(screen.getByPlaceholderText("Ask anything…"), "count{Enter}");
    await waitFor(() => expect(error).toBe(limited));
    expect(document.querySelector("[data-slot=chat-error] [data-slot=diagnostic]")?.getAttribute("data-code")).toBe("ai/rate-limited");
  });

  it("is the AI SDK's conversation otherwise: it asks, and the answer streams in", async () => {
    const { model } = mockModel(() => "Four.");
    render(<Harness agent={new ToolLoopAgent({ model })} />);
    await userEvent.setup().type(screen.getByPlaceholderText("Ask anything…"), "count{Enter}");
    expect(await screen.findByText("Four.")).not.toBeNull();
    expect(document.querySelector("[data-slot=chat-error]")).toBeNull();
  });
});
