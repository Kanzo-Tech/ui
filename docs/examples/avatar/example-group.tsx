import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@kanzo-tech/ui";
import { initialsOf, membersOf } from "@/example/people";

const roster = membersOf("amber");

export default function Example() {
  return (
    <AvatarGroup>
      {roster.slice(0, 3).map((entry) => (
        <Avatar key={entry.id}>
          <AvatarFallback>{initialsOf(entry.name)}</AvatarFallback>
        </Avatar>
      ))}
      <AvatarGroupCount>+{roster.length - 3}</AvatarGroupCount>
    </AvatarGroup>
  );
}
