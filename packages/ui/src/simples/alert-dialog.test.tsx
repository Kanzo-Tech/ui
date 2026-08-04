import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
} from "./alert-dialog.js";

const renderAlertDialog = (props?: {
  onAction?: () => void;
  onCancel?: () => void;
}) =>
  render(
    <AlertDialog>
      <AlertDialogTrigger>Delete dataset</AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader
          description="This removes customers.ttl and its 1,204 triples."
          title="Delete customers.ttl?"
        />

        <AlertDialogBody>
          Mappings that reference the graph will start failing.
        </AlertDialogBody>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={props?.onCancel}>Cancel</AlertDialogCancel>

          <AlertDialogAction onClick={props?.onAction} variant="destructive">
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  );

const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Delete dataset" }));

  return screen.findByRole("alertdialog");
};

describe("AlertDialog", () => {
  it("opens from its trigger, as an alertdialog", async () => {
    const user = userEvent.setup();
    renderAlertDialog();

    expect(screen.queryByRole("alertdialog")).toBeNull();

    expect(await open(user)).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Delete" }).getAttribute("data-slot"),
    ).toBe("alert-dialog-action");
  });

  it("closes the dialog from AlertDialogAction, and still fires its onClick", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderAlertDialog({ onAction });

    await open(user);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("closes the dialog from AlertDialogCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderAlertDialog({ onCancel });

    await open(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps the action's variant while it carries the close behaviour", async () => {
    const user = userEvent.setup();
    renderAlertDialog();

    await open(user);

    expect(
      screen
        .getByRole("button", { name: "Delete" })
        .getAttribute("data-variant"),
    ).toBe("destructive");
  });
});
