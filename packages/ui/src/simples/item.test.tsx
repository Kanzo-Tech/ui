import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "./item.js";

describe("Item", () => {
  it("declares list semantics on the group and its rows", () => {
    render(
      <ItemGroup>
        <Item>
          <ItemContent>
            <ItemTitle>One</ItemTitle>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemContent>
            <ItemTitle>Two</ItemTitle>
          </ItemContent>
        </Item>
      </ItemGroup>
    );

    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("mirrors variant to data-variant", () => {
    render(
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Row</ItemTitle>
        </ItemContent>
      </Item>
    );

    const item = screen.getByRole("listitem");
    expect(item.getAttribute("data-variant")).toBe("outline");
    expect(item.getAttribute("data-slot")).toBe("item");
  });

  it("tags each targetable part with a data-slot", () => {
    render(
      <Item>
        <ItemMedia>
          <svg aria-hidden />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Title</ItemTitle>
          <ItemDescription>Desc</ItemDescription>
        </ItemContent>
        <ItemActions>
          <button type="button">Go</button>
        </ItemActions>
      </Item>
    );

    expect(screen.getByText("Title").getAttribute("data-slot")).toBe("item-title");
    expect(screen.getByText("Desc").getAttribute("data-slot")).toBe("item-description");
    expect(screen.getByText("Go").parentElement?.getAttribute("data-slot")).toBe("item-actions");
  });

  it("keeps ItemTitle a flex row, so a multi-child title still gets its gap", () => {
    // `line-clamp-1` used to sit in the same `cn` as `flex`; both set `display`, so
    // tailwind-merge dropped `flex` and every title with more than one child rendered its
    // children flush against each other. Re-adding a clamp here re-breaks that.
    render(
      <Item>
        <ItemContent>
          <ItemTitle>
            <span>Brand</span>
            <code>#737373</code>
          </ItemTitle>
        </ItemContent>
      </Item>
    );

    const title = screen.getByText("Brand").parentElement;
    expect(title?.className).toContain("flex");
    expect(title?.className).toContain("gap-2");
    expect(title?.className).not.toMatch(/\bline-clamp-/);
  });

  it("lets a call site opt into clamping, and gives up the flex row to do it", () => {
    render(
      <Item>
        <ItemContent>
          <ItemTitle className="line-clamp-1">A title long enough to want clamping</ItemTitle>
        </ItemContent>
      </Item>
    );

    const title = screen.getByText("A title long enough to want clamping");
    expect(title.className).toContain("line-clamp-1");
    expect(title.className).not.toMatch(/\bflex\b/);
  });
});
