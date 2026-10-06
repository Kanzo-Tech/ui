import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { createListCollection } from "@ark-ui/react/collection";
import { Command, CommandContent, CommandDialog, CommandDialogContent, CommandInput, CommandItem, CommandList } from "./command.js";

const collection = createListCollection({ items: [{ label: "Ana", value: "ana" }] });

function Palette({ controlled }: { controlled?: boolean }) {
  const [open, setOpen] = useState(false);
  const control = controlled ? { open, onOpenChange: (e: { open: boolean }) => setOpen(e.open) } : {};
  return (
    <CommandDialog hotkey="mod+k" {...control}>
      <CommandDialogContent>
        <Command collection={collection}>
          <CommandInput placeholder="Find" />
          <CommandContent>
            <CommandList>
              <CommandItem item={collection.items[0]}>Ana</CommandItem>
            </CommandList>
          </CommandContent>
        </Command>
      </CommandDialogContent>
    </CommandDialog>
  );
}

describe("a palette summoned by its key", () => {
  it.each([false, true])("hotkey mod+k opens the dialog, uncontrolled or controlled (controlled: %s)", async (controlled) => {
    render(<Palette controlled={controlled} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("CommandInput draws its children before the input", () => {
    render(
      <Command collection={collection}>
        <CommandInput placeholder="Find">
          <span data-testid="chip">type:Person</span>
        </CommandInput>
      </Command>,
    );
    const chip = screen.getByTestId("chip");
    const input = screen.getByPlaceholderText("Find");
    expect(chip.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
