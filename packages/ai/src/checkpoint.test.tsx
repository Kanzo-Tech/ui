import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from "./checkpoint.js";
import { Message, MessageContent, MessageList } from "./message.js";

describe("Checkpoint", () => {
  it("is an item of the transcript between two turns, its rule hidden as paint", () => {
    render(
      <MessageList>
        <Message>
          <MessageContent>Preview 1</MessageContent>
        </Message>
        <Checkpoint>
          <CheckpointIcon />
          <span>Preview 2</span>
          <CheckpointTrigger />
        </Checkpoint>
        <Message>
          <MessageContent>Preview 3</MessageContent>
        </Message>
      </MessageList>,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]?.getAttribute("data-slot")).toBe("checkpoint");
    expect(screen.queryByRole("separator")).toBeNull();
    expect(items[1]?.querySelector("[data-slot=checkpoint-icon]")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("restores nothing itself: the trigger is a button that hands the press to the host", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(
      <ul>
        <Checkpoint>
          <span>Preview 2</span>
          <CheckpointTrigger onClick={onRestore} />
        </Checkpoint>
      </ul>,
    );

    const trigger = screen.getByRole("button", { name: "Restore" });
    expect(trigger.getAttribute("type")).toBe("button");
    await user.click(trigger);
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("says its word in the host's language, unless given words of its own", () => {
    const { rerender } = render(<CheckpointTrigger translations={{ restore: "Restaurar" }} />);
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeTruthy();
    rerender(<CheckpointTrigger>Go back to Preview 2</CheckpointTrigger>);
    expect(screen.getByRole("button", { name: "Go back to Preview 2" })).toBeTruthy();
  });
});
