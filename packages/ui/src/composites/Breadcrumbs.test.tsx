import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Breadcrumbs } from "./Breadcrumbs.js";

const TRAIL = [
  { label: "Jobs", href: "/jobs" },
  { label: "aemet.fossil", href: "/jobs/aemet" },
  { label: "Runs", href: "/jobs/aemet/runs" },
  { label: "Discover" },
];

const list = () => screen.getByRole("list");

describe("Breadcrumbs", () => {
  it("is a landmark with a name, so a screen reader can jump to it", () => {
    render(<Breadcrumbs items={TRAIL} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
  });

  it("marks only the last entry as the current page", () => {
    render(<Breadcrumbs items={TRAIL} />);
    const current = screen.getByText("Discover");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Jobs",
      "aemet.fossil",
      "Runs",
    ]);
  });

  it("renders an entry without an href as text, not a dead link", () => {
    render(<Breadcrumbs items={[{ label: "Jobs" }, { label: "Discover" }]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("keeps separators as siblings of the items, never nested inside them", () => {
    // An `li` inside an `li` is invalid markup and breaks the row count screen readers announce.
    render(<Breadcrumbs items={TRAIL} />);
    for (const item of within(list()).getAllByRole("listitem")) {
      expect(item.querySelector("li")).toBeNull();
    }
  });

  describe("collapse", () => {
    it("hides the middle behind a menu and keeps the ends", () => {
      render(<Breadcrumbs items={TRAIL} maxItems={3} />);
      const labels = within(list())
        .getAllByRole("listitem")
        .map((li) => li.textContent?.trim())
        .filter(Boolean);
      expect(labels).toContain("Jobs");
      expect(labels).toContain("Runs");
      expect(labels).toContain("Discover");
      expect(labels).not.toContain("aemet.fossil");
    });

    it("makes the collapsed entries reachable rather than merely hidden", async () => {
      const user = userEvent.setup();
      render(<Breadcrumbs items={TRAIL} maxItems={3} />);

      await user.click(screen.getByRole("button", { name: "Show the rest of the trail" }));
      const item = await screen.findByRole("menuitem", { name: "aemet.fossil" });
      expect(item.getAttribute("href")).toBe("/jobs/aemet");
    });

    it("does nothing when the trail already fits", () => {
      render(<Breadcrumbs items={TRAIL} maxItems={4} />);
      expect(screen.getByText("aemet.fossil")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("ignores a maxItems below 2 — a trail needs a root and a leaf", () => {
      render(<Breadcrumbs items={TRAIL} maxItems={1} />);
      expect(screen.getByText("aemet.fossil")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("still marks the last entry as current after collapsing", () => {
      render(<Breadcrumbs items={TRAIL} maxItems={2} />);
      expect(screen.getByText("Discover").getAttribute("aria-current")).toBe("page");
    });
  });
});
