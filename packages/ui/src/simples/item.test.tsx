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
});
