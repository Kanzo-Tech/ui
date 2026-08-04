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
import { FlameIcon, HammerIcon, ShieldIcon } from "lucide-react";
import { Fragment } from "react";
import { member } from "@/example/people";
import { hall, role } from "@/example/world";

const ROWS = [
  { icon: ShieldIcon, member: member("ravenna") },
  { icon: FlameIcon, member: member("bell") },
  { icon: HammerIcon, member: member("marrow") },
];

export default function Example() {
  return (
    <ItemGroup className="w-96 gap-0 rounded-lg border">
      {ROWS.map(({ icon: Icon, member: entry }, i) => (
        <Fragment key={entry.id}>
          <Show when={i > 0}>
            <ItemSeparator />
          </Show>
          <Item>
            <ItemMedia>
              <Icon />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{entry.name}</ItemTitle>
              <ItemDescription>
                {role(entry.role).label} · {hall(entry.hall).short}
              </ItemDescription>
            </ItemContent>
          </Item>
        </Fragment>
      ))}
    </ItemGroup>
  );
}
