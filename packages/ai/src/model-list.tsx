import { Combobox as ArkCombobox } from "@ark-ui/react/combobox";
import { Command, ComboboxItem, cn } from "@kanzo-tech/ui";

/**
 * **Choosing which model answers — a `Command` that keeps what you picked.**
 *
 * The list of models is a search over a set, which is `Command`'s whole shape: a filter input, a
 * scrolling list, groups, an empty state. What it is *not* is a palette, and that is the entire
 * reason this component exists rather than a paragraph telling callers to pass two props.
 *
 * ## The two things a caller gets wrong, and both are silent
 *
 * **`selectionBehavior`.** `Command`'s root pins `"clear"`, which is right for a palette: you run
 * *Rename file*, the query is thrown away, and nothing is "selected" afterwards because a command
 * is an act. A model is a **value** — it stays chosen, the list reopens on it, and clearing the
 * selection on pick means the control forgets what it is set to a frame after being told. Overriding
 * it is legal rather than lucky: `Command` spreads `{...rest}` *after* its own defaults, which is
 * the one property of that component this depends on.
 *
 * **The row.** `CommandItem` pins `showIndicator: false`, again correctly — a palette row is a verb
 * and there is nothing to tick. Here there is: exactly one model is in force, and a list of values
 * with no mark on the current one is a list that cannot answer *which*. So the row is
 * `ComboboxItem`, with its indicator left on.
 *
 * Neither override announces itself when it is missing. A palette-shaped model picker looks correct
 * in a screenshot, filters correctly, and is wrong only in the moment after a click.
 *
 * ## What it deliberately is not
 *
 * **No trigger and no popover.** A model picker is a popover in one product, a settings row in the
 * next and a sidebar section in the third; the arrangement is the caller's and always has been.
 * This is the list.
 *
 * **No `Model` type.** The barrel already re-exports Ark's collection trio —
 * `createListCollection`, `useListCollection`, `ListCollection` — and a model is whatever shape the
 * host's registry hands back. A type here would be a fourth way to describe a collection item.
 *
 * **It enters against admission rule 2**, with one call site in this repository. See
 * `decisions/a-picker-that-forgets-its-value-is-a-defect.md` for why that was accepted and what
 * would reverse it.
 */
export const ModelList: ArkCombobox.RootComponent = (props) => {
  const { className, ...rest } = props;

  return (
    <Command
      className={cn("gap-1", className)}
      // Before `{...rest}`, so a caller who genuinely wants palette semantics can still say so —
      // and after `Command`'s own, which is the whole mechanism.
      selectionBehavior="preserve"
      {...rest}
    />
  );
};

/**
 * One model. `ComboboxItem` with a `data-slot` of its own, which is the difference between styling
 * *the rows of a model list* and styling *every combobox item on the page*.
 */
export const ModelListItem = (props: React.ComponentProps<typeof ComboboxItem>) => {
  const { slot, ...rest } = props;
  return <ComboboxItem {...rest} slot={slot ?? "model-list-item"} />;
};
