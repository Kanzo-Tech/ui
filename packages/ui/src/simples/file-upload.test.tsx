import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useFileUpload as useArkFileUpload } from "@ark-ui/react/file-upload";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  FileUpload,
  FileUploadClearTrigger,
  FileUploadItem,
  FileUploadItemGroup,
  FileUploadItemName,
  FileUploadItemPreview,
  FileUploadItemPreviewImage,
  FileUploadRootProvider,
} from "./file-upload.js";

const png = () => new File(["png"], "shot.png", { type: "image/png" });

// jsdom implements no object URL store, and Zag's `createFileUrl` calls it on mount to give the
// preview image its `src`. Without the stub `FileUploadItemPreviewImage` throws in render here and
// only here — the browser has the real one.
beforeAll(() => {
  URL.createObjectURL ??= () => "blob:shot.png";
  URL.revokeObjectURL ??= () => undefined;
});

describe("FileUploadClearTrigger", () => {
  const renderWithClear = () =>
    render(
      <FileUpload defaultAcceptedFiles={[png()]}>
        <FileUploadItemGroup>
          <FileUploadItem file={png()}>
            <FileUploadItemName />
          </FileUploadItem>
        </FileUploadItemGroup>

        <FileUploadClearTrigger>Clear</FileUploadClearTrigger>
      </FileUpload>
    );

  it("empties the machine's accepted files when pressed", async () => {
    const onFileChange = vi.fn();

    render(
      <FileUpload defaultAcceptedFiles={[png()]} onFileChange={onFileChange}>
        <FileUploadClearTrigger>Clear</FileUploadClearTrigger>
      </FileUpload>
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(onFileChange).toHaveBeenCalled());
    expect(onFileChange.mock.calls.at(-1)?.[0].acceptedFiles).toEqual([]);
  });

  it("carries its slot on the Button, where asChild leaves it reachable", () => {
    renderWithClear();

    const trigger = screen.getByRole("button", { name: "Clear" });

    // The slot has to be on the child: Ark's `asChild` merge hands the parent's attributes down
    // and `Button` writes its own after its spread, so a `data-slot` on the trigger is discarded.
    expect(trigger.getAttribute("data-slot")).toBe("file-upload-clear-trigger");
    expect(trigger.className).toContain("inline-flex");
  });
});

describe("FileUploadItemPreviewImage", () => {
  it("renders the image inside its item preview", () => {
    render(
      <FileUpload defaultAcceptedFiles={[png()]}>
        <FileUploadItemGroup>
          <FileUploadItem file={png()}>
            <FileUploadItemPreview type="image/*">
              <FileUploadItemPreviewImage />
            </FileUploadItemPreview>
          </FileUploadItem>
        </FileUploadItemGroup>
      </FileUpload>
    );

    const image = document.querySelector(
      "[data-slot=file-upload-item-preview-image]"
    ) as HTMLElement;

    expect(image).not.toBeNull();
    expect(image.tagName).toBe("IMG");
  });
});

describe("FileUploadRootProvider", () => {
  it("drives the same compound from a machine the caller owns", () => {
    const Controlled = () => {
      const fileUpload = useArkFileUpload({ acceptedFiles: [png()] });

      return (
        <FileUploadRootProvider value={fileUpload}>
          <FileUploadItemGroup>
            <FileUploadItem file={png()}>
              <FileUploadItemName />
            </FileUploadItem>
          </FileUploadItemGroup>
        </FileUploadRootProvider>
      );
    };

    render(<Controlled />);

    expect(
      document.querySelector("[data-slot=file-upload-root-provider]")
    ).not.toBeNull();
    expect(screen.getByText("shot.png")).not.toBeNull();
  });
});
