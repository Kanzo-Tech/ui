import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@kanzo-tech/ui";
import { BoxIcon } from "lucide-react";

export default function Example() {
  return (
    <div className="flex w-96 flex-col gap-3">
      {(["default", "outline", "muted"] as const).map((variant) => (
        <Item key={variant} variant={variant}>
          <ItemMedia>
            <BoxIcon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="capitalize">{variant}</ItemTitle>
            <ItemDescription>The {variant} row surface.</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
