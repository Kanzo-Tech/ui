import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@kanzo-tech/ui";
import { FileTextIcon } from "lucide-react";

export default function Example() {
  return (
    <Item className="w-96" variant="outline">
      <ItemMedia>
        <FileTextIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>dataset.csv</ItemTitle>
        <ItemDescription>2.4 MB · updated 3 days ago</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button size="sm" variant="outline">
          Open
        </Button>
      </ItemActions>
    </Item>
  );
}
