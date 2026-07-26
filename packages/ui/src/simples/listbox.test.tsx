import { createListCollection } from "@ark-ui/react/collection";
import type {
  ListboxSelectionMode,
  ListboxValueChangeDetails,
} from "@ark-ui/react/listbox";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Listbox,
  ListboxContent,
  ListboxEmpty,
  ListboxItem,
  ListboxItemGroup,
  ListboxItemIndicator,
  ListboxItemText,
  ListboxLabel,
} from "./listbox.js";

interface Framework {
  label: string;
  value: string;
}

const frameworks = createListCollection<Framework>({
  items: [
    { label: "React", value: "react" },
    { label: "Svelte", value: "svelte" },
    { label: "Vue", value: "vue" },
  ],
});

const empty = createListCollection<Framework>({ items: [] });

// `Listbox` is generic over the collection item, so `ComponentProps` would erase the item
// type to `unknown`. Name the props the tests actually vary instead.
interface RenderProps {
  defaultValue?: string[];
  selectionMode?: ListboxSelectionMode;
  onValueChange?: (details: ListboxValueChangeDetails<Framework>) => void;
  deselectable?: boolean;
}

const renderListbox = (props?: RenderProps) =>
  render(
    <Listbox collection={frameworks} {...props}>
      <ListboxLabel>Framework</ListboxLabel>

      <ListboxContent>
        {frameworks.items.map((item) => (
          <ListboxItem item={item} key={item.value}>
            <ListboxItemText>{item.label}</ListboxItemText>

            <ListboxItemIndicator />
          </ListboxItem>
        ))}
      </ListboxContent>
    </Listbox>,
  );

const option = (name: string) => screen.getByRole("option", { name });
const indicatorOf = (name: string) =>
  option(name).querySelector("[data-slot=listbox-item-indicator]");

describe("Listbox", () => {
  it("renders one option per collection item", () => {
    renderListbox();

    expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual([
      "React",
      "Svelte",
      "Vue",
    ]);
  });

  it("names the list from its label, with no trigger to borrow from", () => {
    renderListbox();

    expect(screen.getByRole("listbox", { name: "Framework" })).not.toBeNull();
  });

  it("renders inline — no portal, no positioner, no trigger", () => {
    const { container } = renderListbox();

    expect(container.querySelector("[data-slot=listbox-content]")).not.toBeNull();
    expect(document.body.querySelector("[data-part=positioner]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("Listbox single selection", () => {
  it("selects one item and replaces it on the next click", async () => {
    const user = userEvent.setup();
    renderListbox();

    await user.click(option("React"));

    expect(option("React").getAttribute("aria-selected")).toBe("true");
    expect(option("Svelte").getAttribute("aria-selected")).toBe("false");

    await user.click(option("Svelte"));

    expect(option("React").getAttribute("aria-selected")).toBe("false");
    expect(option("Svelte").getAttribute("aria-selected")).toBe("true");
  });

  it("reports the change with the value and the item", async () => {
    const user = userEvent.setup();
    const changes: { value: string[]; labels: string[] }[] = [];

    renderListbox({
      onValueChange: (details) =>
        changes.push({
          value: details.value,
          labels: details.items.map((item) => item.label),
        }),
    });

    await user.click(option("Vue"));

    expect(changes).toEqual([{ value: ["vue"], labels: ["Vue"] }]);
  });

  it("honours defaultValue", () => {
    renderListbox({ defaultValue: ["svelte"] });

    expect(option("Svelte").getAttribute("aria-selected")).toBe("true");
  });

  it("is not multi-selectable", () => {
    renderListbox();

    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBeNull();
  });
});

describe("Listbox multiple selection", () => {
  it("accumulates selections without a modifier key", async () => {
    const user = userEvent.setup();
    renderListbox({ selectionMode: "multiple" });

    await user.click(option("React"));
    await user.click(option("Vue"));

    expect(option("React").getAttribute("aria-selected")).toBe("true");
    expect(option("Vue").getAttribute("aria-selected")).toBe("true");
    expect(option("Svelte").getAttribute("aria-selected")).toBe("false");
  });

  it("toggles a selected item back off", async () => {
    const user = userEvent.setup();
    renderListbox({ selectionMode: "multiple", defaultValue: ["react"] });

    await user.click(option("React"));

    expect(option("React").getAttribute("aria-selected")).toBe("false");
  });

  it("announces itself as multi-selectable", () => {
    renderListbox({ selectionMode: "multiple" });

    expect(
      screen.getByRole("listbox").getAttribute("aria-multiselectable"),
    ).toBe("true");
  });
});

describe("ListboxItemIndicator", () => {
  it("is hidden until its item is selected", async () => {
    const user = userEvent.setup();
    renderListbox();

    expect(indicatorOf("React")?.getAttribute("data-state")).toBe("unchecked");
    expect(indicatorOf("React")?.hasAttribute("hidden")).toBe(true);

    await user.click(option("React"));

    expect(indicatorOf("React")?.getAttribute("data-state")).toBe("checked");
    expect(indicatorOf("React")?.hasAttribute("hidden")).toBe(false);
    expect(indicatorOf("Svelte")?.hasAttribute("hidden")).toBe(true);
  });

  it("reserves its gutter whether or not the item is selected", () => {
    renderListbox({ defaultValue: ["react"] });

    // `:has()` matches the hidden indicator too, so the padding rule that makes room for
    // the check is on every item — a selected row never shifts sideways.
    for (const label of ["React", "Svelte"]) {
      expect(option(label).className).toContain(
        "has-[[data-slot=listbox-item-indicator]]:pe-8",
      );
    }
  });
});

describe("ListboxEmpty", () => {
  it("renders only when the collection has no items", () => {
    const { rerender } = render(
      <Listbox collection={empty}>
        <ListboxContent>
          <ListboxEmpty>No frameworks</ListboxEmpty>
        </ListboxContent>
      </Listbox>,
    );

    expect(screen.getByText("No frameworks")).not.toBeNull();

    rerender(
      <Listbox collection={frameworks}>
        <ListboxContent>
          <ListboxEmpty>No frameworks</ListboxEmpty>
        </ListboxContent>
      </Listbox>,
    );

    expect(screen.queryByText("No frameworks")).toBeNull();
  });
});

describe("ListboxItemGroup", () => {
  it("labels the group and indents the items under it", () => {
    render(
      <Listbox collection={frameworks}>
        <ListboxContent>
          <ListboxItemGroup heading="Frontend">
            {frameworks.items.map((item) => (
              <ListboxItem item={item} key={item.value}>
                <ListboxItemText>{item.label}</ListboxItemText>
              </ListboxItem>
            ))}
          </ListboxItemGroup>
        </ListboxContent>
      </Listbox>,
    );

    expect(screen.getByRole("group", { name: "Frontend" })).not.toBeNull();
    expect(option("React").className).toContain(
      "in-[[data-slot=listbox-content]:has([data-slot=listbox-item-group-label])]:ps-4",
    );
  });

  // Zag's JSDoc for `deselectable` reads "whether to disallow empty selection", which is backwards:
  // the machine assigns it to `selection.deselectable`, and the selection manager only unticks an
  // already-selected value in single mode WHEN IT IS TRUE. It is also undefined by default, so the
  // machine's `!!prop(...)` makes it false — overriding the collection's own default of true. Both
  // halves are pinned here because a version bump could reverse either silently, and `FacetFilter`
  // depends on this to let `multiple={false}` return to "nothing chosen".
  it("keeps a single selection stuck without `deselectable`", async () => {
    const user = userEvent.setup();
    renderListbox({ defaultValue: ["react"] });

    await user.click(option("React"));

    expect(option("React").getAttribute("aria-selected")).toBe("true");
  });

  it("unticks a single selection when `deselectable`", async () => {
    const user = userEvent.setup();
    renderListbox({ defaultValue: ["react"], deselectable: true });

    await user.click(option("React"));

    expect(option("React").getAttribute("aria-selected")).toBe("false");
  });

  it("unticks in multiple mode regardless of `deselectable`", async () => {
    const user = userEvent.setup();
    renderListbox({ defaultValue: ["react"], selectionMode: "multiple" });

    await user.click(option("React"));

    expect(option("React").getAttribute("aria-selected")).toBe("false");
  });
});
