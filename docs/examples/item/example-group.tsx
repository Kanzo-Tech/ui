import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@kanzo-tech/ui";
import { CloudIcon, DatabaseIcon, KeyIcon } from "lucide-react";

const ROWS = [
  { icon: DatabaseIcon, title: "Postgres", description: "eu-west-1" },
  { icon: CloudIcon, title: "S3 bucket", description: "kanzo-exports" },
  { icon: KeyIcon, title: "API key", description: "rotated last week" },
];

export default function Example() {
  return (
    <ItemGroup className="w-96 rounded-lg border">
      {ROWS.map(({ icon: Icon, title, description }, i) => (
        <div key={title}>
          {i > 0 && <ItemSeparator />}
          <Item>
            <ItemMedia>
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{title}</ItemTitle>
              <ItemDescription>{description}</ItemDescription>
            </ItemContent>
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}
