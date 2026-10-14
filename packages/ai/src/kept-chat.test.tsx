import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { scriptedModel } from "@kanzo-tech/llm/testing";
import { ToolLoopAgent, type UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { useAgentChat, type AgentChatOptions } from "./agent-chat.js";
import { Chat } from "./chat.js";
import { useKeptChat } from "./kept-chat.js";

type Note = { text: string };
type Kept = UIMessage<never, { note: Note }>;

/** A data part's schema, as Standard Schema: a note is `{ text }`, and nothing else rides along. */
const note = {
  "~standard": {
    version: 1,
    vendor: "test",
    validate: (value: unknown) =>
      typeof value === "object" && value !== null && typeof (value as Note).text === "string"
        ? { value: { text: (value as Note).text } }
        : { issues: [{ message: "A note is { text }." }] },
  },
} as const;

const stored: Kept[] = [
  { id: "1", role: "user", parts: [{ type: "text", text: "How many?" }] },
  { id: "2", role: "assistant", parts: [{ type: "text", text: "Four." }, { type: "data-note", data: { text: "counted" } }] },
];

/** A store: what `load` answers per id, and every `save` it was handed, in order. */
function store(initial: Record<string, unknown> = {}) {
  const chats = new Map(Object.entries(initial));
  const saves: { id: string; messages: Kept[] }[] = [];
  let release: (() => void) | undefined;
  return {
    saves,
    loads: 0,
    /** Hold every save until `go()`. */
    hold() {
      let go!: () => void;
      const held = new Promise<void>((resolve) => (go = resolve));
      release = go;
      return held;
    },
    go: () => release?.(),
    held: undefined as Promise<void> | undefined,
    load: async function (this: { loads: number }, id: string) {
      this.loads++;
      return chats.get(id) ?? [];
    },
    async save(id: string, messages: Kept[]) {
      saves.push({ id, messages });
      await this.held;
      chats.set(id, messages);
    },
  };
}

function Harness(props: { agent: ToolLoopAgent; options: AgentChatOptions<Kept> }) {
  const chat = useAgentChat(props.agent, props.options as never) as unknown as Parameters<typeof Chat<Kept>>[0]["chat"];
  return <Chat chat={chat} />;
}

const agentSaying = (...replies: string[]) => new ToolLoopAgent({ model: scriptedModel({ turns: replies.map((text) => ({ reply: { text } })) }) });

describe("a kept chat", () => {
  it("opens where it stood: the chat of its id is read once, validated, and drawn", async () => {
    const s = store({ c: stored });
    render(<Harness agent={agentSaying()} options={{ id: "c", load: (id) => s.load(id), save: (id, m) => s.save(id, m), dataPartSchemas: { note } }} />);
    expect(document.querySelector("[data-slot=chat-skeleton]")).not.toBeNull();
    expect(await screen.findByText("Four.")).not.toBeNull();
    expect(screen.getByText("How many?")).not.toBeNull();
    expect(s.loads).toBeGreaterThan(0);
    expect(s.saves).toEqual([]);
  });

  it("is saved at the end of every turn, whole, through keep", async () => {
    const s = store({ c: stored });
    const keep = (part: Kept["parts"][number]) => (part.type === "reasoning" ? undefined : part.type === "data-note" ? { ...part, data: { text: "kept" } } : part);
    render(
      <Harness
        agent={agentSaying("Five.")}
        options={{ id: "c", load: (id) => s.load(id), save: (id, m) => s.save(id, m), keep, dataPartSchemas: { note } }}
      />,
    );
    await screen.findByText("Four.");
    await userEvent.setup().type(screen.getByPlaceholderText("Ask anything…"), "And now?{Enter}");
    expect(await screen.findByText("Five.")).not.toBeNull();
    await waitFor(() => expect(s.saves).toHaveLength(1));
    const [saved] = s.saves;
    expect(saved!.id).toBe("c");
    expect(saved!.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(saved!.messages[1]!.parts.find((p) => p.type === "data-note")).toMatchObject({ data: { text: "kept" } });
  });

  it("never opens empty in place of a chat it cannot read, and never saves over it", async () => {
    const s = store({ c: [{ id: "1", role: "assistant", parts: [{ type: "data-note", data: { words: 3 } }] }] });
    let seen: unknown;
    function Seen() {
      const chat = useAgentChat(agentSaying("Five."), { id: "c", load: (id: string) => s.load(id), save: (id: string, m: Kept[]) => s.save(id, m), dataPartSchemas: { note } } as never);
      seen = (chat as { kept?: { state: string; error: unknown } }).kept;
      return <Chat chat={chat} />;
    }
    render(<Seen />);
    await waitFor(() => expect((seen as { state: string }).state).toBe("failed"));
    expect((seen as { error: unknown }).error).toBeInstanceOf(Error);
    expect(document.querySelector("[data-slot=chat-kept-error] [data-slot=diagnostic]")).not.toBeNull();
    expect(document.querySelector("[data-slot=chat] [inert]")).not.toBeNull();
    expect(s.saves).toEqual([]);
  });

  it("saves one at a time, in order, and refuses what keep left unreadable", async () => {
    const s = store();
    const { result } = renderHook(() =>
      useKeptChat<Kept>({ id: "c", load: (id) => s.load(id), save: (id, m) => s.save(id, m), dataPartSchemas: { note } as never }),
    );
    await waitFor(() => expect(result.current.state).toBe("ready"));
    expect(result.current.messages).toEqual([]);

    s.held = s.hold();
    let first!: Promise<void>, second!: Promise<void>;
    act(() => {
      first = result.current.save(stored.slice(0, 1));
      second = result.current.save(stored);
    });
    await waitFor(() => expect(s.saves).toHaveLength(1));
    expect(s.saves[0]!.messages).toHaveLength(1);
    s.held = undefined;
    s.go();
    await act(() => Promise.all([first, second]));
    expect(s.saves.map((x) => x.messages.length)).toEqual([1, 2]);

    const unreadable = [{ id: "3", role: "assistant", parts: [{ type: "data-note", data: { words: 3 } }] }] as unknown as Kept[];
    await act(() => expect(result.current.save(unreadable)).rejects.toBeInstanceOf(Error));
    expect(s.saves).toHaveLength(2);
    await waitFor(() => expect(result.current.state).toBe("unsaved"));
    await act(() => result.current.save(stored));
    expect(result.current.state).toBe("ready");
  });
});
