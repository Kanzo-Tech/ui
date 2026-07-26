import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
  Show,
} from "@kanzo-tech/ui";
import { CloudIcon, DatabaseIcon, KeyIcon } from "lucide-react";
import { Fragment } from "react";

const ROWS = [
  { icon: DatabaseIcon, title: "Postgres", description: "eu-west-1" },
  { icon: CloudIcon, title: "S3 bucket", description: "kanzo-exports" },
  { icon: KeyIcon, title: "API key", description: "rotated last week" },
];

export default function Example() {
  return (
    <ItemGroup className="w-96 gap-0 rounded-lg border">
      {ROWS.map(({ icon: Icon, title, description }, i) => (
        <Fragment key={title}>
          <Show when={i > 0}>
            <ItemSeparator />
          </Show>
          <Item>
            <ItemMedia>
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{title}</ItemTitle>
              <ItemDescription>{description}</ItemDescription>
            </ItemContent>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  );
}
