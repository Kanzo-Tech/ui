import { InboxIcon } from "lucide-react";
import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    // An empty state is a vertical Item: the same media · content · actions vocabulary, centred.
    // `max-w-[420px]` on the description is what keeps the sentence readable rather than letting
    // it stretch the width of a table.
    <Item className="flex-col gap-3 py-10 text-center" variant="muted">
      <ItemMedia className="[&_svg]:size-8">
        <InboxIcon />
      </ItemMedia>
      <ItemContent className="items-center">
        {/* `asChild` puts the title in the surrounding document outline: an empty state inside
            a section under an h2 is an h3. */}
        <ItemTitle asChild>
          <h3>No datasets yet</h3>
        </ItemTitle>
        <ItemDescription className="max-w-[420px]">
          Connect a source to start ingesting records. Nothing is imported until you pick a
          schema.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm">Connect a source</Button>
      </ItemActions>
    </Item>
  );
}
