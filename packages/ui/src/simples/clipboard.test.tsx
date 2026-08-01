import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Clipboard,
  ClipboardControl,
  ClipboardValueText,
} from "./clipboard.js";

describe("ClipboardValueText", () => {
  it("renders the root's value as text, without an editable control", () => {
    render(
      <Clipboard value="https://kanzo.tech/share/abc">
        <ClipboardControl>
          <ClipboardValueText />
        </ClipboardControl>
      </Clipboard>
    );

    expect(screen.getByText("https://kanzo.tech/share/abc")).not.toBeNull();
    expect(document.querySelector("input")).toBeNull();
  });

  it("owns its data-slot after the spread, so a caller cannot erase it", () => {
    render(
      <Clipboard value="x">
        <ClipboardValueText
          {...({ "data-slot": "whatever" } as Record<string, string>)}
        />
      </Clipboard>
    );

    expect(
      document.querySelector("[data-slot=clipboard-value-text]")
    ).not.toBeNull();
    expect(document.querySelector("[data-slot=whatever]")).toBeNull();
  });

  it("draws the field box its recipe shares with ClipboardInput", () => {
    render(
      <Clipboard value="x">
        <ClipboardValueText />
      </Clipboard>
    );

    const value = document.querySelector(
      "[data-slot=clipboard-value-text]"
    ) as HTMLElement;

    expect(value.className).toContain("border-input");
    expect(value.className).toContain("text-muted-foreground");
  });
});
