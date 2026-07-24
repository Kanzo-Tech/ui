import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button.js";
import { DownloadTrigger } from "./download-trigger.js";

describe("DownloadTrigger", () => {
  it("renders a button tagged with its data-slot", () => {
    render(
      <DownloadTrigger
        data="{}"
        fileName="schema.json"
        mimeType="application/json"
      >
        Download
      </DownloadTrigger>
    );

    const trigger = screen.getByRole("button", { name: "Download" });
    expect(trigger.getAttribute("data-slot")).toBe("download-trigger");
  });

  it("composes our Button via asChild", () => {
    render(
      <DownloadTrigger
        asChild
        data="{}"
        fileName="schema.json"
        mimeType="application/json"
      >
        <Button variant="outline">Save</Button>
      </DownloadTrigger>
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
  });
});
