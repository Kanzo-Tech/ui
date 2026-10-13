import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Message,
  MessageContent,
  MessageList,
} from "./message.js";

const Transcript = () => (
  <MessageList>
    <Message role="user">
      <MessageContent>Which reports were filed by a cantor?</MessageContent>
    </Message>
    <Message role="assistant">
      <MessageContent>Four of them.</MessageContent>
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

  it("names every part, and a slot may be renamed", () => {
    render(<Transcript />);

    expect(document.querySelector("[data-slot=message-list]")).not.toBeNull();
    expect(document.querySelector("[data-slot=message-content]")).not.toBeNull();

    render(
      <Message slot="finding">
        <MessageContent slot="finding-body">Renamed.</MessageContent>
      </Message>,
    );
    expect(document.querySelector("[data-slot=finding-body]")?.textContent).toBe("Renamed.");
  });
});
