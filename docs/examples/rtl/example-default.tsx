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

const Row = () => (
  <Item className="w-96" variant="outline">
    <ItemMedia>
      <FileTextIcon />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>dataset.csv</ItemTitle>
      <ItemDescription>updated three days ago</ItemDescription>
    </ItemContent>
    <ItemActions>
      <Button size="sm" variant="outline">
        Open
      </Button>
    </ItemActions>
  </Item>
);

export default function Example() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2" dir="ltr">
        <span className="text-muted-foreground text-xs">dir=&quot;ltr&quot;</span>
        <Row />
      </div>
      <div className="flex flex-col gap-2" dir="rtl">
        {/* The label is LTR on purpose: inside the RTL box its own quotes would reorder, which
            says more about bidi text than about the layout this example is showing. */}
        <span className="text-muted-foreground text-xs" dir="ltr">
          dir=&quot;rtl&quot;
        </span>
        <Row />
      </div>
    </div>
  );
}
