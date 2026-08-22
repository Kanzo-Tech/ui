import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageList,
} from "./message.js";

const Transcript = () => (
  <MessageList>
    <Message role="user">
      <MessageAvatar name="Ada Lovelace" />
      <MessageContent>Which reports were filed by a cantor?</MessageContent>
    </Message>
    <Message role="assistant">
      <MessageAvatar name="Kanzo" />
      <MessageContent>Four of them.</MessageContent>
      <MessageActions>
        <button type="button">Copy</button>
      </MessageActions>
    </Message>
  </MessageList>
);

describe("Message", () => {
  it("is a list of turns, each declaring its role once", () => {
    render(<Transcript />);

    const turns = screen.getAllByRole("listitem");
    expect(turns).toHaveLength(2);
    expect(turns[0]?.getAttribute("data-role")).toBe("user");
    expect(turns[1]?.getAttribute("data-role")).toBe("assistant");
  });

  // The role reaches the parts through a group selector on the root, so a part carrying its own
  // copy is a second source of truth that can disagree with the first.
  it("puts the role on the root and nowhere else", () => {
    render(<Transcript />);

    for (const turn of screen.getAllByRole("listitem")) {
      expect(turn.querySelectorAll("[data-role]")).toHaveLength(0);
    }
  });

  it("defaults the role to assistant", () => {
    render(
      <MessageList>
        <Message>
          <MessageContent>Thinking about it.</MessageContent>
        </Message>
      </MessageList>,
    );

    expect(screen.getByRole("listitem").getAttribute("data-role")).toBe("assistant");
  });

  it("draws an avatar from the name, and hands it over to children when given", () => {
    render(<Transcript />);

    const [user] = screen.getAllByRole("listitem");
    expect(within(user as HTMLElement).getByText("AL").getAttribute("data-slot")).toBe(
      "avatar-fallback",
    );

    render(
      <MessageList>
        <Message>
          <MessageAvatar name="Kanzo">
            <span>✨</span>
          </MessageAvatar>
        </Message>
      </MessageList>,
    );
    expect(screen.getByText("✨")).not.toBeNull();
  });

  it("names every part, and a slot may be renamed", () => {
    render(<Transcript />);

    expect(document.querySelector("[data-slot=message-list]")).not.toBeNull();
    expect(document.querySelector("[data-slot=message-content]")).not.toBeNull();
    expect(document.querySelector("[data-slot=message-avatar]")).not.toBeNull();
    expect(document.querySelector("[data-slot=message-actions]")).not.toBeNull();

    render(
      <Message slot="finding">
        <MessageContent slot="finding-body">Renamed.</MessageContent>
      </Message>,
    );
    expect(document.querySelector("[data-slot=finding-body]")?.textContent).toBe("Renamed.");
  });
});
